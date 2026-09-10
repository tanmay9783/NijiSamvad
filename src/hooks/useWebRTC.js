import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function useWebRTC(socket, roomUsers, isCallActive) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [mediaState, setMediaState] = useState({ audio: true, video: true });
  
  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  // Initialize Media
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Start initially muted for safety if desired, but we'll keep enabled for now
      stream.getAudioTracks().forEach(track => track.enabled = mediaState.audio);
      stream.getVideoTracks().forEach(track => track.enabled = mediaState.video);

      return stream;
    } catch (err) {
      console.error("Error accessing media devices.", err);
      return null;
    }
  }, [mediaState]);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const createPeer = useCallback((targetSocketId, stream) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks
    if (stream) {
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
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
      setRemoteStreams(prev => ({
        ...prev,
        [targetSocketId]: event.streams[0]
      }));
    };

    return peer;
  }, [socket]);

  // Handle Call Lifecycle
  useEffect(() => {
    if (!isCallActive || !socket) return;

    let isMounted = true;

    const initCall = async () => {
      const stream = await startLocalStream();
      if (!stream || !isMounted) return;

      // Create offers for all existing users
      roomUsers.forEach(async (user) => {
        if (user.id !== socket.id) {
          const peer = createPeer(user.id, stream);
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
      });
    };

    initCall();

    return () => {
      isMounted = false;
      // Cleanup all peers
      Object.values(peersRef.current).forEach(peer => peer.close());
      peersRef.current = {};
      setRemoteStreams({});
      stopLocalStream();
    };
  }, [isCallActive, socket, roomUsers, createPeer, startLocalStream, stopLocalStream]);

  // Handle Socket Signaling Events
  useEffect(() => {
    if (!socket || !isCallActive) return;

    const handleOffer = async ({ sdp, callerSocketId }) => {
      let peer = peersRef.current[callerSocketId];
      if (!peer) {
        peer = createPeer(callerSocketId, localStreamRef.current);
        peersRef.current[callerSocketId] = peer;
      }
      
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
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
      const peer = peersRef.current[answererSocketId];
      if (peer) {
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (e) {
          console.error("Error handling answer", e);
        }
      }
    };

    const handleIceCandidate = async ({ candidate, senderSocketId }) => {
      const peer = peersRef.current[senderSocketId];
      if (peer) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      }
    };

    // Listen for disconnects
    const handleUserLeft = (_leftName) => {
        // Find user by name in roomUsers to get their socket id
        // In our current architecture, 'left' event provides username.
        // It's better to just wait for roomUsers to update, which triggers cleanup.
    };

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('left', handleUserLeft);

    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('left', handleUserLeft);
    };
  }, [socket, isCallActive, createPeer]);

  // Cleanup remote streams when users leave
  useEffect(() => {
    const activeIds = new Set(roomUsers.map(u => u.id));
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      let changed = false;
      Object.keys(newStreams).forEach(id => {
        if (!activeIds.has(id)) {
          delete newStreams[id];
          changed = true;
          if (peersRef.current[id]) {
            peersRef.current[id].close();
            delete peersRef.current[id];
          }
        }
      });
      return changed ? newStreams : prev;
    });
  }, [roomUsers]);

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
