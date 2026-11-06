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
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [isBackgroundBlurred, setIsBackgroundBlurred] = useState(false);
  const [acceptedPeers, setAcceptedPeers] = useState({}); // socketId -> name

  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const displayTrackRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);
  const blurCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const blurVideoElementRef = useRef(null);
  const blurAnimationRef = useRef(null);
  const blurredVideoTrackRef = useRef(null);
  const roomUsersRef = useRef(roomUsers);
  const candidateQueueRef = useRef({});

  // Clean up a specific peer connection and its streams
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

  useEffect(() => {
    roomUsersRef.current = roomUsers;
    // Immediate departure detection: if any peer in call leaves roomUsers, clean them up immediately
    if (Array.isArray(roomUsers)) {
      const activeUserIds = new Set(roomUsers.map(u => u.id));
      Object.keys(peersRef.current).forEach(peerId => {
        if (!activeUserIds.has(peerId)) {
          cleanupPeer(peerId);
        }
      });
    }
  }, [roomUsers, cleanupPeer]);

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

  // Initialize Local Camera/Microphone Stream (Mobile + Desktop Optimized)
  const startLocalStream = useCallback(async () => {
    // 1. Try with mobile front-camera and standard audio constraints
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
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
      console.warn("Primary camera access failed, trying unconstrained video/audio fallback...", err);
      // 2. Try simple unconstrained video + audio
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
    setIsBackgroundBlurred(false);

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

  const createPeer = useCallback((targetSocketId, stream) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks if available
    if (stream && stream.getTracks().length > 0) {
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
    }

    // Ensure transceivers exist with sendrecv so mobile and desktop can always exchange both audio and video
    const transceivers = peer.getTransceivers();
    if (!transceivers.some(t => t.receiver && t.receiver.track && t.receiver.track.kind === 'audio')) {
      try { peer.addTransceiver('audio', { direction: 'sendrecv' }); } catch (e) {}
    }
    if (!transceivers.some(t => t.receiver && t.receiver.track && t.receiver.track.kind === 'video')) {
      try { peer.addTransceiver('video', { direction: 'sendrecv' }); } catch (e) {}
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
      // Turn ON blur: try native platform capability or canvas portrait blur
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

          // 1. Full-frame blurred background pass
          ctx.save();
          ctx.filter = 'blur(18px)';
          ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // 2. Feathered sharp subject overlay (Natural depth-of-field bokeh, NO harsh circular cutout)
          if (!maskCanvasRef.current) {
            maskCanvasRef.current = document.createElement('canvas');
          }
          const mask = maskCanvasRef.current;
          if (mask.width !== canvas.width || mask.height !== canvas.height) {
            mask.width = canvas.width;
            mask.height = canvas.height;
          }
          const mCtx = mask.getContext('2d');
          mCtx.clearRect(0, 0, mask.width, mask.height);
          
          // Draw sharp video onto mask canvas
          mCtx.drawImage(hiddenVideo, 0, 0, mask.width, mask.height);
          
          // Apply soft feathered gradient mask that smoothly fades into the blurred background
          mCtx.globalCompositeOperation = 'destination-in';
          const grad = mCtx.createRadialGradient(
            mask.width / 2, mask.height * 0.50, mask.width * 0.20,
            mask.width / 2, mask.height * 0.50, mask.width * 0.60
          );
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(0.5, 'rgba(0,0,0,0.85)');
          grad.addColorStop(0.8, 'rgba(0,0,0,0.35)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          mCtx.fillStyle = grad;
          mCtx.fillRect(0, 0, mask.width, mask.height);
          
          // Composite the feathered sharp subject over the blurred background
          ctx.drawImage(mask, 0, 0);

          blurAnimationRef.current = requestAnimationFrame(renderBlur);
        };
        blurAnimationRef.current = requestAnimationFrame(renderBlur);

        const canvasStream = canvas.captureStream(30);
        const blurredTrack = canvasStream.getVideoTracks()[0];
        blurredVideoTrackRef.current = blurredTrack;

        // Immediately update local preview to show blur locally!
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

