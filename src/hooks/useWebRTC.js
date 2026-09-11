import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

export default function useWebRTC(socket, roomUsers) {
  const [callState, setCallState] = useState('idle'); // idle, incoming, outgoing, connecting, connected, ended
  const [incomingCall, setIncomingCall] = useState(null); // { callerSocketId, callerName }
  const [activeCallRoom, setActiveCallRoom] = useState(false); // room has an active call
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [mediaState, setMediaState] = useState({ audio: true, video: true });
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [acceptedPeers, setAcceptedPeers] = useState({}); // socketId -> name

  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const displayTrackRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);
  const roomUsersRef = useRef(roomUsers);
  const candidateQueueRef = useRef({});

  useEffect(() => {
    roomUsersRef.current = roomUsers;
  }, [roomUsers]);

  // Top-level Unmount Cleanup (Memory Leak Fix)
  useEffect(() => {
    return () => {
      // Intentionally using refs here to avoid stale closures during unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (displayTrackRef.current) {
        displayTrackRef.current.stop();
      }
      Object.keys(peersRef.current).forEach(id => {
        const peer = peersRef.current[id];
        if (peer) {
          peer.onicecandidate = null;
          peer.ontrack = null;
          peer.onconnectionstatechange = null;
          peer.close();
        }
      });
    };
  }, []);

  // Initialize Local Camera/Microphone Stream
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) cameraVideoTrackRef.current = videoTrack;

      stream.getAudioTracks().forEach(track => track.enabled = mediaState.audio);
      stream.getVideoTracks().forEach(track => track.enabled = mediaState.video);

      return stream;
    } catch (err) {
      console.warn("Error accessing camera/mic. Trying audio-only fallback...", err);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
        setLocalStream(audioStream);
        localStreamRef.current = audioStream;

        audioStream.getAudioTracks().forEach(track => track.enabled = mediaState.audio);
        setMediaState(prev => ({ ...prev, video: false })); // Force video to false since not available

        return audioStream;
      } catch (fallbackErr) {
        console.warn("Failed all media access. Continuing as receive-only.", fallbackErr);
        return null;
      }
    }
  }, [mediaState.audio, mediaState.video]);

  const stopLocalStream = useCallback(() => {
    if (displayTrackRef.current) {
      displayTrackRef.current.stop();
      displayTrackRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }
    cameraVideoTrackRef.current = null;
    setIsScreenSharing(false);
  }, []);

  const cleanupPeer = useCallback((id) => {
    if (peersRef.current[id]) {
      peersRef.current[id].onicecandidate = null;
      peersRef.current[id].ontrack = null;
      peersRef.current[id].onconnectionstatechange = null;
      peersRef.current[id].close();
      delete peersRef.current[id];
    }
    delete candidateQueueRef.current[id];
    setAcceptedPeers(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[id];
      return newStreams;
    });
  }, []);

  const createPeer = useCallback((targetSocketId, stream) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks if available, otherwise fallback to recvonly transceivers
    if (stream && stream.getTracks().length > 0) {
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
    } else {
      try {
        peer.addTransceiver('audio', { direction: 'recvonly' });
        peer.addTransceiver('video', { direction: 'recvonly' });
      } catch (e) {}
    }

    // Handle ICE Candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Handle incoming streams
    peer.ontrack = (event) => {
      let incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : null;
      if (!incomingStream && event.track) {
        incomingStream = new MediaStream([event.track]);
      }

      if (incomingStream) {
        setRemoteStreams(prev => ({
          ...prev,
          [targetSocketId]: incomingStream
        }));
        setCallState('connected');
      }
    };

    // Handle Connection State
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setCallState('connected');
      } else if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        cleanupPeer(targetSocketId);
      }
    };

    return peer;
  }, [socket, cleanupPeer]);

  // Flush queued ICE candidates
  const flushIceCandidates = useCallback(async (targetSocketId, peer) => {
    const queue = candidateQueueRef.current[targetSocketId];
    if (queue && queue.length > 0) {
      for (const cand of queue) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.error("Error adding queued ICE candidate", e);
        }
      }
      delete candidateQueueRef.current[targetSocketId];
    }
  }, []);

  // Initiate Call: Broadcast invitation to same-room users
  const startCall = useCallback(async () => {
    if (!socket) return;
    setCallState('outgoing');
    setActiveCallRoom(true);
    await startLocalStream();
    socket.emit('call-invite');
  }, [socket, startLocalStream]);

  // Accept Call Invitation (or join active call)
  const acceptCall = useCallback(async (callerId) => {
    if (!socket) return;
    const targetId = callerId || (incomingCall ? incomingCall.callerSocketId : null);
    setIncomingCall(null);
    setCallState('connecting');
    setActiveCallRoom(true);

    const stream = await startLocalStream();

    if (targetId) {
      socket.emit('call-accept', { targetSocketId: targetId });
      
      // Initiate offer if socket.id > targetId
      if (socket.id > targetId && !peersRef.current[targetId]) {
        const peer = createPeer(targetId, stream);
        peersRef.current[targetId] = peer;
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit('webrtc-offer', { targetSocketId: targetId, sdp: peer.localDescription });
        } catch (e) {
          console.error("Error creating offer", e);
        }
      }
    } else {
      // Joining active room call: notify all peers in room
      roomUsersRef.current.forEach(u => {
        if (u.id !== socket.id) {
          socket.emit('call-accept', { targetSocketId: u.id });
        }
      });
    }
  }, [socket, incomingCall, startLocalStream, createPeer]);

  // Decline Call Invitation
  const declineCall = useCallback(() => {
    if (socket && incomingCall) {
      socket.emit('call-decline', { targetSocketId: incomingCall.callerSocketId });
    }
    setIncomingCall(null);
    setCallState('idle');
  }, [socket, incomingCall]);

  // Cancel Outgoing Call
  const cancelCall = useCallback(() => {
    if (socket) {
      socket.emit('call-cancel');
    }
    stopLocalStream();
    setCallState('idle');
    setActiveCallRoom(false);
  }, [socket, stopLocalStream]);

  // End / Leave Call
  const endCall = useCallback(() => {
    if (socket) {
      socket.emit('call-ended');
    }
    Object.keys(peersRef.current).forEach(id => {
      cleanupPeer(id);
    });
    stopLocalStream();
    setCallState('idle');
    setActiveCallRoom(false);
  }, [socket, cleanupPeer, stopLocalStream]);

  // Screen Sharing Implementation using RTCRtpSender.replaceTrack()
  const stopScreenShare = useCallback(async () => {
    if (displayTrackRef.current) {
      displayTrackRef.current.stop();
      displayTrackRef.current = null;
    }
    setIsScreenSharing(false);

    const replacementTrack = mediaState.video ? cameraVideoTrackRef.current : null;

    // Replace display track back to camera track across all active peer connections
    for (const peerId of Object.keys(peersRef.current)) {
      const peer = peersRef.current[peerId];
      if (peer) {
        const senders = peer.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          try {
            await videoSender.replaceTrack(replacementTrack);
          } catch (e) {
            console.error("Error restoring camera track", e);
          }
        }
      }
    }
  }, [mediaState.video]);

  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error("Screen sharing is not supported by your browser.");
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const displayTrack = displayStream.getVideoTracks()[0];
      if (!displayTrack) return;

      displayTrackRef.current = displayTrack;
      setIsScreenSharing(true);

      // Replace video track across all active RTCPeerConnections
      for (const peerId of Object.keys(peersRef.current)) {
        const peer = peersRef.current[peerId];
        if (peer) {
          const senders = peer.getSenders();
          const videoSender = senders.find(s => s.track && (s.track.kind === 'video' || s.track === cameraVideoTrackRef.current));
          if (videoSender) {
            await videoSender.replaceTrack(displayTrack);
          }
        }
      }

      // Handle user clicking native browser "Stop sharing" bar
      displayTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error("Screen share error", err);
        throw err;
      }
    }
  }, [stopScreenShare]);

  // ALWAYS active Socket Signaling Events for call invitations and WebRTC
  useEffect(() => {
    if (!socket) return;

    const isValidSender = (id) => roomUsersRef.current.some(u => u.id === id);

    const handleCallInvite = ({ callerSocketId, callerName }) => {
      if (!isValidSender(callerSocketId)) return;
      if (callState === 'idle') {
        setIncomingCall({ callerSocketId, callerName });
        setCallState('incoming');
      }
      setActiveCallRoom(true);
    };

    const handleCallAccept = async ({ accepterSocketId, accepterName }) => {
      if (!isValidSender(accepterSocketId)) return;
      setAcceptedPeers(prev => ({ ...prev, [accepterSocketId]: accepterName }));
      setActiveCallRoom(true);

      if (callState === 'outgoing' || callState === 'connecting' || callState === 'connected') {
        setCallState('connecting');

        let currentStream = localStreamRef.current;
        if (!currentStream) {
          currentStream = await startLocalStream();
        }

        // Initiate offer deterministically if socket.id > accepterSocketId
        if (socket.id > accepterSocketId && !peersRef.current[accepterSocketId]) {
          const peer = createPeer(accepterSocketId, currentStream);
          peersRef.current[accepterSocketId] = peer;
          try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.emit('webrtc-offer', { targetSocketId: accepterSocketId, sdp: peer.localDescription });
          } catch (e) {
            console.error("Error creating offer after accept", e);
          }
        }
      }
    };

    const handleCallDecline = ({ declinerSocketId, declinerName }) => {
      if (!isValidSender(declinerSocketId)) return;
      setAcceptedPeers(prev => {
        const copy = { ...prev };
        delete copy[declinerSocketId];
        return copy;
      });
    };

    const handleCallCancel = ({ callerSocketId }) => {
      if (incomingCall && incomingCall.callerSocketId === callerSocketId) {
        setIncomingCall(null);
        setCallState('idle');
      }
    };

    const handleCallEnded = ({ socketId }) => {
      cleanupPeer(socketId);
    };

    const handleOffer = async ({ sdp, callerSocketId }) => {
      if (!isValidSender(callerSocketId)) return;

      let currentStream = localStreamRef.current;
      if (!currentStream) {
        currentStream = await startLocalStream();
      }

      let peer = peersRef.current[callerSocketId];

      // Handle offer collision (glare) in mesh connection
      const isOfferCollision = peer && (peer.signalingState !== 'stable');
      const isPolite = socket.id < callerSocketId;

      if (isOfferCollision) {
        if (!isPolite) return; // Impolite peer ignores colliding offer
        try {
          await peer.setLocalDescription({ type: 'rollback' });
        } catch (e) {}
      }

      if (!peer) {
        peer = createPeer(callerSocketId, currentStream);
        peersRef.current[callerSocketId] = peer;
      }
      
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushIceCandidates(callerSocketId, peer);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          targetSocketId: callerSocketId,
          sdp: peer.localDescription
        });
        setCallState('connected');
      } catch (e) {
        console.error("Error handling offer", e);
      }
    };

    const handleAnswer = async ({ sdp, answererSocketId }) => {
      if (!isValidSender(answererSocketId)) return;
      const peer = peersRef.current[answererSocketId];
      if (peer) {
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushIceCandidates(answererSocketId, peer);
          setCallState('connected');
        } catch (e) {
          console.error("Error handling answer", e);
        }
      }
    };

    const handleIceCandidate = async ({ candidate, senderSocketId }) => {
      if (!isValidSender(senderSocketId)) return;
      const peer = peersRef.current[senderSocketId];
      if (peer && peer.remoteDescription) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      } else {
        if (!candidateQueueRef.current[senderSocketId]) {
          candidateQueueRef.current[senderSocketId] = [];
        }
        candidateQueueRef.current[senderSocketId].push(candidate);
      }
    };

    socket.on('call-invite', handleCallInvite);
    socket.on('call-accept', handleCallAccept);
    socket.on('call-decline', handleCallDecline);
    socket.on('call-cancel', handleCallCancel);
    socket.on('call-ended', handleCallEnded);
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);

    return () => {
      socket.off('call-invite', handleCallInvite);
      socket.off('call-accept', handleCallAccept);
      socket.off('call-decline', handleCallDecline);
      socket.off('call-cancel', handleCallCancel);
      socket.off('call-ended', handleCallEnded);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
    };
  }, [socket, callState, incomingCall, createPeer, startLocalStream, flushIceCandidates, cleanupPeer]);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMediaState(prev => ({ ...prev, audio: audioTrack.enabled }));
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setMediaState(prev => ({ ...prev, video: videoTrack.enabled }));
      }
    }
  };

  return {
    callState,
    incomingCall,
    activeCallRoom,
    localStream,
    remoteStreams,
    mediaState,
    isScreenSharing,
    acceptedPeers,
    startCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo
  };
}

