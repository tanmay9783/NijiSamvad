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

export default function useWebRTC(socket, roomUsers, isCallActive, setIsCallActive) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [mediaState, setMediaState] = useState({ audio: true, video: true });
  
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const roomUsersRef = useRef(roomUsers);
  const candidateQueueRef = useRef({});

  useEffect(() => {
    roomUsersRef.current = roomUsers;
  }, [roomUsers]);

  // Initialize Media
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      stream.getAudioTracks().forEach(track => track.enabled = mediaState.audio);
      stream.getVideoTracks().forEach(track => track.enabled = mediaState.video);

      return stream;
    } catch (err) {
      console.warn("Error accessing media devices. Continuing as receive-only.", err);
      return null;
    }
  }, [mediaState]);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }
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
      }
    };

    // Handle Connection State
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
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

  // Handle Call Lifecycle and Dynamic Joins
  useEffect(() => {
    if (!isCallActive || !socket) return;

    let isMounted = true;

    const initCall = async () => {
      if (!localStreamRef.current) {
        await startLocalStream();
      }
      if (!isMounted) return;

      const activeIds = new Set(roomUsersRef.current.map(u => u.id));

      // Initiate offers for peers
      for (const user of roomUsersRef.current) {
        if (user.id !== socket.id && !peersRef.current[user.id]) {
          const peer = createPeer(user.id, localStreamRef.current);
          peersRef.current[user.id] = peer;
          
          try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.emit('webrtc-offer', {
              targetSocketId: user.id,
              sdp: peer.localDescription
            });
          } catch (e) {
            console.error("Error creating offer", e);
          }
        }
      }

      // Cleanup peers for users who left
      Object.keys(peersRef.current).forEach(id => {
        if (!activeIds.has(id)) {
          cleanupPeer(id);
        }
      });
    };

    initCall();

    return () => {
      isMounted = false;
    };
  }, [isCallActive, socket, roomUsers, createPeer, startLocalStream, cleanupPeer]);

  // Full cleanup on Call End
  useEffect(() => {
    if (!isCallActive) {
      Object.keys(peersRef.current).forEach(id => {
        cleanupPeer(id);
      });
      stopLocalStream();
    }
  }, [isCallActive, cleanupPeer, stopLocalStream]);

  // ALWAYS active Socket Signaling Events for incoming call offers/answers
  useEffect(() => {
    if (!socket) return;

    const isValidSender = (id) => roomUsersRef.current.some(u => u.id === id);

    const handleOffer = async ({ sdp, callerSocketId }) => {
      if (!isValidSender(callerSocketId)) return;

      if (setIsCallActive) {
        setIsCallActive(true);
      }

      let currentStream = localStreamRef.current;
      if (!currentStream) {
        currentStream = await startLocalStream();
      }

      let peer = peersRef.current[callerSocketId];
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

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);

    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
    };
  }, [socket, createPeer, startLocalStream, flushIceCandidates, setIsCallActive]);

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
    localStream,
    remoteStreams,
    mediaState,
    toggleAudio,
    toggleVideo
  };
}

