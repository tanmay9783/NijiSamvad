import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './VideoPlayer';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, Maximize, Minimize, 
  MessageSquare, PhoneCall, Pin, PinOff, Grid, User, LayoutGrid, Square, Tv 
} from 'lucide-react';

// Custom Hook to monitor audio volume for active speaker detection
function useAudioVolume(stream) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream) {
      setIsSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setIsSpeaking(false);
      return;
    }

    let audioCtx;
    let analyser;
    let source;
    let animFrameId;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;

      audioCtx = new AudioCtxClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;

      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let silenceCounter = 0;

      const detectVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        if (avg > 10) {
          silenceCounter = 0;
          setIsSpeaking(true);
        } else {
          silenceCounter++;
          if (silenceCounter > 12) { // ~200ms debounce to avoid flickering
            setIsSpeaking(false);
          }
        }

        animFrameId = requestAnimationFrame(detectVolume);
      };

      detectVolume();
    } catch (err) {
      console.warn("AudioContext active speaker analysis blocked/failed:", err);
    }

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (source) {
        try { source.disconnect(); } catch (e) {}
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        try { audioCtx.close(); } catch (e) {}
      }
    };
  }, [stream]);

  return isSpeaking;
}

// Single Participant Video Card Tile with Active Speaker Equalizer
function ParticipantTile({ 
  id, 
  stream, 
  isLocal, 
  label, 
  isScreenSharing, 
  mediaState, 
  isFeatured, 
  isPinned, 
  onTogglePin,
  onSpeakingChange 
}) {
  const isSpeaking = useAudioVolume(stream);

  useEffect(() => {
    if (onSpeakingChange) {
      onSpeakingChange(id, isSpeaking);
    }
  }, [id, isSpeaking, onSpeakingChange]);

  return (
    <div 
      className={`video-container ${isLocal ? 'local-container' : ''} ${isFeatured ? 'is-featured' : ''} ${isPinned ? 'is-pinned' : ''} ${isSpeaking ? 'active-speaker' : ''}`}
      onDoubleClick={(e) => onTogglePin(id, e)}
      title="Double-click to pin / unpin video"
    >
      <VideoPlayer stream={stream} isLocal={isLocal} muted={isLocal} />
      
      {/* Video Tile Label & Equalizer */}
      <div className="video-label">
        {isSpeaking && (
          <div className="soundwave-equalizer" title="Speaking">
            <span className="eq-bar bar-1"></span>
            <span className="eq-bar bar-2"></span>
            <span className="eq-bar bar-3"></span>
          </div>
        )}
        <span>{label}</span>
      </div>

      {/* Media Status Icons */}
      <div className="video-status">
        {isLocal && mediaState && !mediaState.audio && (
          <MicOff size={14} className="status-icon error" />
        )}
        {isLocal && mediaState && !mediaState.video && !isScreenSharing && (
          <VideoOff size={14} className="status-icon error" />
        )}
      </div>

      {/* Hover Pin Button */}
      <button 
        className={`tile-pin-btn ${isPinned ? 'pinned' : ''}`}
        onClick={(e) => onTogglePin(id, e)}
        title={isPinned ? "Unpin video" : "Pin video"}
      >
        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
    </div>
  );
}

export default function CallInterface({ 
  callState,
  localStream, 
  remoteStreams, 
  mediaState, 
  isScreenSharing,
  onToggleAudio, 
  onToggleVideo, 
  onToggleScreenShare,
  onCancelCall,
  onEndCall,
  showChat,
  onToggleChat
}) {
  const [pinnedPeerId, setPinnedPeerId] = useState(null); // null, 'local', or remote socketId
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' or 'speaker'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState({}); // { [id]: boolean }
  const callContainerRef = useRef(null);

  const remoteSocketIds = Object.keys(remoteStreams);
  const totalParticipants = remoteSocketIds.length + 1;

  // Active Speaker Handler Callback
  const handleSpeakingChange = useCallback((id, speaking) => {
    setActiveSpeakers(prev => {
      if (prev[id] === speaking) return prev;
      return { ...prev, [id]: speaking };
    });
  }, []);

  // Auto-feature screen sharing if screen share is turned on and nothing explicitly pinned
  useEffect(() => {
    if (isScreenSharing && !pinnedPeerId) {
      setPinnedPeerId('local');
    }
  }, [isScreenSharing]);

  // If pinned peer leaves, clear pin
  useEffect(() => {
    if (pinnedPeerId && pinnedPeerId !== 'local' && !remoteStreams[pinnedPeerId]) {
      setPinnedPeerId(null);
    }
  }, [remoteStreams, pinnedPeerId]);

  // Toggle Pin handler
  const handleTogglePin = (id, e) => {
    if (e) e.stopPropagation();
    if (pinnedPeerId === id) {
      setPinnedPeerId(null);
    } else {
      setPinnedPeerId(id);
      setLayoutMode('speaker');
    }
  };

  // Switch View Layout
  const handleToggleLayout = () => {
    if (layoutMode === 'grid') {
      setLayoutMode('speaker');
      if (!pinnedPeerId) {
        setPinnedPeerId(remoteSocketIds[0] || 'local');
      }
    } else {
      setLayoutMode('grid');
    }
  };

  // Handle Native Fullscreen API
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (callContainerRef.current && callContainerRef.current.requestFullscreen) {
        callContainerRef.current.requestFullscreen().catch(err => {
          console.warn("Fullscreen request error", err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.warn("Exit fullscreen error", err);
        });
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-PiP on Tab Switch
  useEffect(() => {
    const handleVisibilityChange = async () => {
      try {
        if (document.visibilityState === 'hidden' && document.pictureInPictureEnabled) {
          if (!document.pictureInPictureElement && callContainerRef.current) {
            const videoEls = callContainerRef.current.querySelectorAll('video');
            if (videoEls.length > 0) {
              await videoEls[0].requestPictureInPicture();
              setIsPipActive(true);
              videoEls[0].addEventListener('leavepictureinpicture', () => {
                setIsPipActive(false);
              }, { once: true });
            }
          }
        } else if (document.visibilityState === 'visible') {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
            setIsPipActive(false);
          }
        }
      } catch (err) {
        console.warn("Auto-PiP on tab switch failed (often requires prior user gesture):", err);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Handle Native Picture-in-Picture (PiP) API
  const togglePictureInPicture = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else if (callContainerRef.current) {
        // Find main active video element
        const videoEls = callContainerRef.current.querySelectorAll('video');
        if (videoEls.length > 0) {
          const targetVideo = videoEls[0];
          await targetVideo.requestPictureInPicture();
          setIsPipActive(true);
          targetVideo.addEventListener('leavepictureinpicture', () => {
            setIsPipActive(false);
          }, { once: true });
        }
      }
    } catch (err) {
      console.warn("Picture-in-Picture error:", err);
    }
  };

  // Outgoing Calling State UI
  if (callState === 'outgoing') {
    return (
      <div className="call-interface outgoing-card-container">
        <div className="outgoing-call-card">
          <div className="pulse-ring active">
            <PhoneCall size={32} className="success-text" />
          </div>
          <h3>Calling Room Participants...</h3>
          <p>Waiting for participants to accept your call invitation.</p>
          <button className="btn btn-danger btn-cancel-call" onClick={onCancelCall}>
            <PhoneOff size={18} /> Cancel Call
          </button>
        </div>
      </div>
    );
  }

  // Determine active featured ID (either explicitly pinned or effective in speaker mode)
  const activeFeaturedId = pinnedPeerId || (layoutMode === 'speaker' ? (remoteSocketIds[0] || 'local') : null);
  const isSpeakerViewActive = layoutMode === 'speaker' || Boolean(pinnedPeerId);
  const isFeaturedSpeaking = activeFeaturedId ? Boolean(activeSpeakers[activeFeaturedId]) : false;

  return (
    <div ref={callContainerRef} className={`call-interface ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Top Header Bar for Zoom-Style Controls */}
      <div className="call-top-bar">
        {/* Screen Sharing Banner */}
        {isScreenSharing ? (
          <div className="screen-share-banner">
            <Monitor size={16} /> You are sharing your screen
          </div>
        ) : (
          <div className="call-status-pill">
            <span className="live-dot"></span> Active Call ({totalParticipants} Participant{totalParticipants > 1 ? 's' : ''})
          </div>
        )}

        {/* View Switcher Controls */}
        <div className="layout-switcher">
          <button 
            className={`layout-btn ${!isSpeakerViewActive ? 'active' : ''}`}
            onClick={() => { setLayoutMode('grid'); setPinnedPeerId(null); }}
            title="Grid View (All participants equal)"
          >
            <LayoutGrid size={16} />
            <span>Grid</span>
          </button>

          <button 
            className={`layout-btn ${isSpeakerViewActive ? 'active' : ''}`}
            onClick={handleToggleLayout}
            title="Speaker / Spotlight View"
          >
            <Square size={16} />
            <span>Speaker</span>
          </button>
        </div>
      </div>

      {/* SPEAKER / FEATURED MAIN STAGE */}
      {isSpeakerViewActive && activeFeaturedId && (
        <div className="featured-video-stage">
          <div className={`featured-video-wrapper ${isFeaturedSpeaking ? 'featured-active-speaker' : ''}`}>
            {activeFeaturedId === 'local' ? (
              <VideoPlayer stream={localStream} isLocal={true} muted={true} />
            ) : (
              <VideoPlayer stream={remoteStreams[activeFeaturedId]} isLocal={false} muted={false} />
            )}
            
            {/* Stage Overlays */}
            <div className="featured-stage-overlay">
              <div className="featured-participant-badge">
                <Pin size={14} className="pinned-icon" />
                <span>
                  {activeFeaturedId === 'local' 
                    ? `You ${isScreenSharing ? '(Screen)' : ''}` 
                    : `Peer ${activeFeaturedId.substring(0, 4)}`}
                </span>
                {isFeaturedSpeaking && (
                  <span className="speaking-tag">Speaking</span>
                )}
                {pinnedPeerId === activeFeaturedId && (
                  <span className="pinned-tag">Pinned</span>
                )}
              </div>

              {/* Unpin Action Button */}
              {pinnedPeerId === activeFeaturedId && (
                <button 
                  className="unpin-stage-btn"
                  onClick={() => setPinnedPeerId(null)}
                  title="Unpin video"
                >
                  <PinOff size={16} /> Unpin
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIDEO TILES (GRID OR HORIZONTAL THUMBNAIL STRIP) */}
      <div 
        className={isSpeakerViewActive ? 'thumbnail-carousel-strip' : `video-grid grid-count-${totalParticipants}`}
      >
        {/* Local Video Tile */}
        <ParticipantTile 
          id="local"
          stream={localStream}
          isLocal={true}
          label={`You ${isScreenSharing ? '(Screen)' : ''}`}
          isScreenSharing={isScreenSharing}
          mediaState={mediaState}
          isFeatured={activeFeaturedId === 'local'}
          isPinned={pinnedPeerId === 'local'}
          onTogglePin={handleTogglePin}
          onSpeakingChange={handleSpeakingChange}
        />

        {/* Remote Video Tiles */}
        {remoteSocketIds.map((id) => (
          <ParticipantTile 
            key={id}
            id={id}
            stream={remoteStreams[id]}
            isLocal={false}
            label={`Peer ${id.substring(0, 4)}`}
            isScreenSharing={false}
            mediaState={null}
            isFeatured={activeFeaturedId === id}
            isPinned={pinnedPeerId === id}
            onTogglePin={handleTogglePin}
            onSpeakingChange={handleSpeakingChange}
          />
        ))}
      </div>

      {/* Meeting Mode Professional Toolbar */}
      <div className="call-controls">
        <button 
          className={`control-btn ${!mediaState.audio ? 'danger' : ''}`} 
          onClick={onToggleAudio}
          title={mediaState.audio ? "Mute Microphone" : "Unmute Microphone"}
        >
          {mediaState.audio ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button 
          className={`control-btn ${!mediaState.video ? 'danger' : ''}`} 
          onClick={onToggleVideo}
          title={mediaState.video ? "Turn Off Camera" : "Turn On Camera"}
        >
          {mediaState.video ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <button 
          className={`control-btn ${isScreenSharing ? 'active-share' : ''}`} 
          onClick={onToggleScreenShare}
          title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
        >
          <Monitor size={20} />
        </button>

        {/* Picture-in-Picture (PiP) Button */}
        {document.pictureInPictureEnabled && (
          <button 
            className={`control-btn ${isPipActive ? 'active-share' : ''}`} 
            onClick={togglePictureInPicture}
            title={isPipActive ? "Exit Picture-in-Picture" : "Picture-in-Picture Mode"}
          >
            <Tv size={20} />
          </button>
        )}

        <button 
          className="control-btn" 
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>

        <button 
          className={`control-btn ${showChat ? 'active-chat' : ''}`} 
          onClick={onToggleChat}
          title={showChat ? "Hide Chat" : "Show Chat"}
        >
          <MessageSquare size={20} />
        </button>

        <button 
          className="control-btn end-call" 
          onClick={onEndCall}
          title="Leave Call"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}


