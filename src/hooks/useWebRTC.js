import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay'
    }
  ],
  iceCandidatePoolSize: 10
};

export default function useWebRTC(socket, roomUsers) {
  const [callState, setCallState] = useState('idle'); // idle, incoming, outgoing, connecting, connected
  const [incomingCall, setIncomingCall] = useState(null); // { callerSocketId, callerName }
  const [activeCallRoom, setActiveCallRoom] = useState(false); // room has an active call
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [mediaState, setMediaState] = useState({ audio: true, video: true });
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [isBackgroundBlurred, setIsBackgroundBlurred] = useState(false);
  const [acceptedPeers, setAcceptedPeers] = useState({}); // socketId -> name

  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const displayTrackRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);
  const blurCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const portraitCanvasRef = useRef(null);
  const blurVideoElementRef = useRef(null);
  const blurAnimationRef = useRef(null);
  const blurredVideoTrackRef = useRef(null);
  const roomUsersRef = useRef(roomUsers);
  const candidateQueueRef = useRef({});
  const callStateRef = useRef(callState);

  // Keep callStateRef synchronized
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Stop local camera/mic stream completely
  const stopLocalStream = useCallback(() => {
    if (blurAnimationRef.current) {
      cancelAnimationFrame(blurAnimationRef.current);
      blurAnimationRef.current = null;
    }
    if (blurVideoElementRef.current) {
      blurVideoElementRef.current.pause();
      blurVideoElementRef.current.srcObject = null;
      if (blurVideoElementRef.current.parentNode) {
        blurVideoElementRef.current.parentNode.removeChild(blurVideoElementRef.current);
      }
      blurVideoElementRef.current = null;
    }
    if (blurredVideoTrackRef.current) {
      blurredVideoTrackRef.current.stop();
      blurredVideoTrackRef.current = null;
    }
    maskCanvasRef.current = null;
    portraitCanvasRef.current = null;
    setIsBackgroundBlurred(false);

    if (displayTrackRef.current) {
      displayTrackRef.current.stop();
      displayTrackRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }
    cameraVideoTrackRef.current = null;
    setIsScreenSharing(false);
  }, []);

  // Clean up a specific peer connection and its streams
  const cleanupPeer = useCallback((id) => {
    if (peersRef.current[id]) {
      const p = peersRef.current[id];
      p.onicecandidate = null;
      p.ontrack = null;
      p.onconnectionstatechange = null;
      p.oniceconnectionstatechange = null;
      try { p.close(); } catch (e) {}
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

  // Initialize Local Camera/Microphone Stream (Mobile + Desktop Optimized)
  const startLocalStream = useCallback(async () => {
    // 0. Reuse active local stream if tracks are still live (avoids mobile camera lock)
    if (localStreamRef.current && localStreamRef.current.getTracks().some(t => t.readyState === 'live')) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) cameraVideoTrackRef.current = videoTrack;
      return localStreamRef.current;
    }

    // 1. Mobile front-facing camera with ideal resolution and standard audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: noiseSuppression,
          autoGainControl: true
        }
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) cameraVideoTrackRef.current = videoTrack;

      stream.getAudioTracks().forEach(track => track.enabled = mediaState.audio);
      stream.getVideoTracks().forEach(track => track.enabled = mediaState.video);

      return stream;
    } catch (err) {
      console.warn("Primary camera access failed, trying unconstrained fallback...", err);
      // 2. Unconstrained fallback (works on any camera, portrait or landscape)
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
      } catch (err2) {
        console.warn("Video access unavailable, trying audio-only fallback...", err2);
        // 3. Audio-only fallback
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });
          setLocalStream(audioStream);
          localStreamRef.current = audioStream;

          audioStream.getAudioTracks().forEach(track => track.enabled = mediaState.audio);
          setMediaState(prev => ({ ...prev, video: false }));

          return audioStream;
        } catch (fallbackErr) {
          console.warn("Failed all media access. Continuing as receive-only.", fallbackErr);
          return null;
        }
      }
    }
  }, [mediaState.audio, mediaState.video, noiseSuppression]);

  // Cleanly create an RTCPeerConnection for a target peer
  const createPeer = useCallback((targetSocketId, stream) => {
    // If an active peer connection exists, close it first before recreating
    if (peersRef.current[targetSocketId]) {
      try { peersRef.current[targetSocketId].close(); } catch (e) {}
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetSocketId] = peer;
    
    // Add local tracks if available
    if (stream && stream.getTracks().length > 0) {
      stream.getTracks().forEach(track => {
        try {
          peer.addTrack(track, stream);
        } catch (e) {
          console.warn("addTrack warning:", e);
        }
      });
    }

    // Only add recvonly transceivers if no sender exists for that media type
    const senders = peer.getSenders();
    const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
    const hasVideo = senders.some(s => s.track && s.track.kind === 'video');

    if (!hasAudio) {
      try { peer.addTransceiver('audio', { direction: 'recvonly' }); } catch (e) {}
    }
    if (!hasVideo) {
      try { peer.addTransceiver('video', { direction: 'recvonly' }); } catch (e) {}
    }

    // Handle ICE Candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
        });
      }
    };

    // ICE Connection monitoring with auto restart
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
        setCallState('connected');
      } else if (peer.iceConnectionState === 'failed') {
        console.warn("ICE connection failed, attempting restart...");
        try { peer.restartIce(); } catch (e) {}
      }
    };

    // Handle incoming streams with complete multi-track accumulation
    peer.ontrack = (event) => {
      const incomingTrack = event.track;
      if (!incomingTrack) return;

      setRemoteStreams(prev => {
        const existing = prev[targetSocketId];
        let allTracks = [];
        if (existing) {
          allTracks = existing.getTracks().filter(t => t.id !== incomingTrack.id && t.readyState === 'live');
        } else if (event.streams && event.streams[0]) {
          allTracks = event.streams[0].getTracks().filter(t => t.id !== incomingTrack.id && t.readyState === 'live');
        }
        allTracks.push(incomingTrack);

        incomingTrack.onended = () => {
          setRemoteStreams(curr => {
            const s = curr[targetSocketId];
            if (!s) return curr;
            const remaining = s.getTracks().filter(t => t.id !== incomingTrack.id && t.readyState === 'live');
            if (remaining.length === 0) {
              const copy = { ...curr };
              delete copy[targetSocketId];
              return copy;
            }
            return { ...curr, [targetSocketId]: new MediaStream(remaining) };
          });
        };

        return {
          ...prev,
          [targetSocketId]: new MediaStream(allTracks)
        };
      });
      setCallState('connected');
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
          await peer.addIceCandidate(cand);
        } catch (e) {
          console.error("Error flushing queued ICE candidate", e);
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
    } else {
      // Joining active room call: notify all peers in room
      if (Array.isArray(roomUsersRef.current)) {
        roomUsersRef.current.forEach(u => {
          if (u.id !== socket.id) {
            socket.emit('call-accept', { targetSocketId: u.id });
          }
        });
      }
    }
  }, [socket, incomingCall, startLocalStream]);

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
    setAcceptedPeers({});
  }, [socket, cleanupPeer, stopLocalStream]);

  // Track roomUsers updates & clean up participants who left room
  useEffect(() => {
    roomUsersRef.current = roomUsers;
    if (Array.isArray(roomUsers)) {
      const activeUserIds = new Set(roomUsers.map(u => u.id));
      Object.keys(peersRef.current).forEach(peerId => {
        if (!activeUserIds.has(peerId)) {
          cleanupPeer(peerId);
        }
      });
      // If we are left alone in the call because the other peer left the room
      if (Object.keys(peersRef.current).length === 0 && callState !== 'idle' && callState !== 'outgoing') {
        stopLocalStream();
        setCallState('idle');
        setActiveCallRoom(false);
        setAcceptedPeers({});
      }
    }
  }, [roomUsers, cleanupPeer, stopLocalStream, callState]);

  // Top-level Unmount Cleanup (Memory Leak Fix)
  useEffect(() => {
    return () => {
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
          peer.oniceconnectionstatechange = null;
          try { peer.close(); } catch (e) {}
        }
      });
    };
  }, []);

  // Socket Signaling Events for call invitations and WebRTC
  useEffect(() => {
    if (!socket) return;

    const handleCallInvite = ({ callerSocketId, callerName }) => {
      if (!callerSocketId || callerSocketId === socket.id) return;
      if (callStateRef.current === 'idle') {
        setIncomingCall({ callerSocketId, callerName });
        setCallState('incoming');
      }
      setActiveCallRoom(true);
    };

    const handleCallAccept = async ({ accepterSocketId, accepterName }) => {
      if (!accepterSocketId || accepterSocketId === socket.id) return;
      setAcceptedPeers(prev => ({ ...prev, [accepterSocketId]: accepterName }));
      setActiveCallRoom(true);
      setCallState('connecting');

      let currentStream = localStreamRef.current;
      if (!currentStream) {
        currentStream = await startLocalStream();
      }

      // Re-initialize peer if closed
      if (peersRef.current[accepterSocketId] && peersRef.current[accepterSocketId].signalingState === 'closed') {
        cleanupPeer(accepterSocketId);
      }

      const peer = createPeer(accepterSocketId, currentStream);
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('webrtc-offer', {
          targetSocketId: accepterSocketId,
          sdp: peer.localDescription
        });
      } catch (e) {
        console.error("Error creating WebRTC offer after accept:", e);
      }
    };

    const handleCallDecline = ({ declinerSocketId, declinerName }) => {
      if (!declinerSocketId || declinerSocketId === socket.id) return;
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
      // If no active peers remain in the call, cleanly transition back to idle
      if (Object.keys(peersRef.current).length === 0) {
        stopLocalStream();
        setCallState('idle');
        setActiveCallRoom(false);
        setAcceptedPeers({});
      }
    };

    const handleOffer = async ({ sdp, callerSocketId }) => {
      if (!callerSocketId || callerSocketId === socket.id) return;
      setActiveCallRoom(true);
      setCallState('connected');

      let currentStream = localStreamRef.current;
      if (!currentStream) {
        currentStream = await startLocalStream();
      }

      if (peersRef.current[callerSocketId] && peersRef.current[callerSocketId].signalingState === 'closed') {
        cleanupPeer(callerSocketId);
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
      } else if (currentStream) {
        // Ensure local tracks are attached to the existing peer connection so video is always sent
        const senders = peer.getSenders();
        currentStream.getTracks().forEach(track => {
          if (!senders.some(s => s.track && s.track.id === track.id)) {
            try { peer.addTrack(track, currentStream); } catch (e) {}
          }
        });
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
        console.error("Error handling offer:", e);
      }
    };

    const handleAnswer = async ({ sdp, answererSocketId }) => {
      if (!answererSocketId || answererSocketId === socket.id) return;
      const peer = peersRef.current[answererSocketId];
      if (peer) {
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushIceCandidates(answererSocketId, peer);
          setCallState('connected');
        } catch (e) {
          console.error("Error handling answer:", e);
        }
      }
    };

    const handleIceCandidate = async ({ candidate, senderSocketId }) => {
      if (!senderSocketId || senderSocketId === socket.id || !candidate) return;
      const peer = peersRef.current[senderSocketId];
      if (peer && peer.remoteDescription && peer.remoteDescription.type) {
        try {
          await peer.addIceCandidate(candidate);
        } catch (e) {
          console.error("Error adding ice candidate:", e);
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
  }, [socket, incomingCall, createPeer, startLocalStream, flushIceCandidates, cleanupPeer, stopLocalStream]);

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

  const toggleNoiseSuppression = useCallback(async () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack && audioTrack.applyConstraints) {
        const nextVal = !noiseSuppression;
        try {
          await audioTrack.applyConstraints({
            echoCancellation: true,
            noiseSuppression: nextVal,
            autoGainControl: true
          });
          setNoiseSuppression(nextVal);
        } catch (e) {
          console.warn("Could not apply audio constraints:", e);
        }
      }
    }
  }, [noiseSuppression]);

  // Full Portrait Bokeh Background Blur (Natural Person Silhouette, NO circular cutout)
  const toggleBackgroundBlur = useCallback(async () => {
    if (!localStreamRef.current) return;
    const currentVideoTrack = cameraVideoTrackRef.current;
    if (!currentVideoTrack) return;

    if (isBackgroundBlurred) {
      // Turn OFF blur: restore original camera video track
      setIsBackgroundBlurred(false);
      if (blurAnimationRef.current) {
        cancelAnimationFrame(blurAnimationRef.current);
        blurAnimationRef.current = null;
      }
      if (blurVideoElementRef.current) {
        blurVideoElementRef.current.pause();
        blurVideoElementRef.current.srcObject = null;
        if (blurVideoElementRef.current.parentNode) {
          blurVideoElementRef.current.parentNode.removeChild(blurVideoElementRef.current);
        }
        blurVideoElementRef.current = null;
      }
      if (blurredVideoTrackRef.current) {
        blurredVideoTrackRef.current.stop();
        blurredVideoTrackRef.current = null;
      }
      maskCanvasRef.current = null;
      portraitCanvasRef.current = null;

      // Restore local stream preview to original camera track
      if (localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        const restoredStream = new MediaStream([...audioTracks, currentVideoTrack]);
        localStreamRef.current = restoredStream;
        setLocalStream(restoredStream);
      }

      for (const peerId of Object.keys(peersRef.current)) {
        const peer = peersRef.current[peerId];
        if (peer) {
          const senders = peer.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video') || senders.find(s => !s.track);
          if (videoSender) {
            try { await videoSender.replaceTrack(currentVideoTrack); } catch(e){}
          }
        }
      }
    } else {
      // Turn ON blur: try native platform capability or natural silhouette bokeh
      try {
        if (currentVideoTrack.getCapabilities && currentVideoTrack.getCapabilities().backgroundBlur) {
          await currentVideoTrack.applyConstraints({ backgroundBlur: true });
          setIsBackgroundBlurred(true);
          return;
        }
      } catch (err) {}

      try {
        const hiddenVideo = document.createElement('video');
        hiddenVideo.autoplay = true;
        hiddenVideo.playsInline = true;
        hiddenVideo.muted = true;
        hiddenVideo.style.position = 'fixed';
        hiddenVideo.style.left = '-9999px';
        hiddenVideo.style.top = '-9999px';
        hiddenVideo.style.width = '1px';
        hiddenVideo.style.height = '1px';
        hiddenVideo.style.opacity = '0';
        hiddenVideo.style.pointerEvents = 'none';
        document.body.appendChild(hiddenVideo);
        blurVideoElementRef.current = hiddenVideo;

        hiddenVideo.srcObject = new MediaStream([currentVideoTrack]);
        await hiddenVideo.play().catch(e => console.warn('Hidden video play error:', e));

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        blurCanvasRef.current = canvas;

        const renderBlur = () => {
          if (!cameraVideoTrackRef.current || cameraVideoTrackRef.current.readyState !== 'live') {
            return;
          }
          if (hiddenVideo.videoWidth && canvas.width !== hiddenVideo.videoWidth) {
            canvas.width = hiddenVideo.videoWidth;
            canvas.height = hiddenVideo.videoHeight;
          }

          const w = canvas.width;
          const h = canvas.height;

          // 1. Full-frame blurred background pass (Entire background room is smoothly blurred)
          ctx.save();
          ctx.filter = 'blur(16px)';
          ctx.drawImage(hiddenVideo, 0, 0, w, h);
          ctx.restore();

          // 2. Feathered natural portrait silhouette (Head, shoulders, and torso remain sharp, NO circular cutout)
          if (!maskCanvasRef.current) {
            maskCanvasRef.current = document.createElement('canvas');
          }
          const mask = maskCanvasRef.current;
          if (mask.width !== w || mask.height !== h) {
            mask.width = w;
            mask.height = h;
          }
          const mCtx = mask.getContext('2d');
          mCtx.clearRect(0, 0, w, h);

          // Draw sharp camera frame onto mask canvas
          mCtx.drawImage(hiddenVideo, 0, 0, w, h);

          // Prepare smooth portrait silhouette mask
          if (!portraitCanvasRef.current) {
            portraitCanvasRef.current = document.createElement('canvas');
          }
          const pCanvas = portraitCanvasRef.current;
          if (pCanvas.width !== w || pCanvas.height !== h) {
            pCanvas.width = w;
            pCanvas.height = h;
          }
          const pCtx = pCanvas.getContext('2d');
          pCtx.clearRect(0, 0, w, h);

          // Head & face oval
          pCtx.fillStyle = '#ffffff';
          pCtx.beginPath();
          pCtx.ellipse(w * 0.50, h * 0.36, w * 0.23, h * 0.28, 0, 0, Math.PI * 2);
          pCtx.fill();

          // Torso & shoulders widening down to bottom of frame
          pCtx.beginPath();
          pCtx.moveTo(w * 0.22, h * 0.44);
          pCtx.bezierCurveTo(w * 0.16, h * 0.60, w * 0.05, h * 0.85, 0, h);
          pCtx.lineTo(w, h);
          pCtx.bezierCurveTo(w * 0.95, h * 0.85, w * 0.84, h * 0.60, w * 0.78, h * 0.44);
          pCtx.closePath();
          pCtx.fill();

          // Feather the silhouette edges softly into the blurred background
          mCtx.globalCompositeOperation = 'destination-in';
          mCtx.filter = 'blur(18px)';
          mCtx.drawImage(pCanvas, 0, 0);
          mCtx.filter = 'none';

          // Composite the feathered sharp portrait over the full-frame blurred background
          ctx.drawImage(mask, 0, 0);

          blurAnimationRef.current = requestAnimationFrame(renderBlur);
        };
        blurAnimationRef.current = requestAnimationFrame(renderBlur);

        const canvasStream = canvas.captureStream(30);
        const blurredTrack = canvasStream.getVideoTracks()[0];
        blurredVideoTrackRef.current = blurredTrack;

        // Immediately update local preview to show natural blur locally
        if (localStreamRef.current) {
          const audioTracks = localStreamRef.current.getAudioTracks();
          const blurredStream = new MediaStream([...audioTracks, blurredTrack]);
          localStreamRef.current = blurredStream;
          setLocalStream(blurredStream);
        }

        setIsBackgroundBlurred(true);

        // Replace track across all remote peer connections
        for (const peerId of Object.keys(peersRef.current)) {
          const peer = peersRef.current[peerId];
          if (peer) {
            const senders = peer.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video') || senders.find(s => !s.track);
            if (videoSender) {
              try { await videoSender.replaceTrack(blurredTrack); } catch(e){}
            }
          }
        }
      } catch (e) {
        console.warn("Could not create canvas blur stream:", e);
      }
    }
  }, [isBackgroundBlurred]);

  return {
    callState,
    incomingCall,
    activeCallRoom,
    localStream,
    remoteStreams,
    mediaState,
    isScreenSharing,
    acceptedPeers,
    noiseSuppression,
    isBackgroundBlurred,
    startCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo,
    toggleNoiseSuppression,
    toggleBackgroundBlur
  };
}
