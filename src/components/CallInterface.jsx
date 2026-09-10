import React, { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, Maximize, Minimize, 
  MessageSquare, PhoneCall, Pin, PinOff, Grid, User, LayoutGrid, Square 
} from 'lucide-react';

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
  const callContainerRef = useRef(null);

  const remoteSocketIds = Object.keys(remoteStreams);
  const totalParticipants = remoteSocketIds.length + 1;

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
        // Default to first remote peer or local peer
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
          <div className="featured-video-wrapper">
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
        <div 
          className={`video-container local-container ${activeFeaturedId === 'local' ? 'is-featured' : ''} ${pinnedPeerId === 'local' ? 'is-pinned' : ''}`}
          onDoubleClick={(e) => handleTogglePin('local', e)}
          title="Double-click to pin / unpin video"
        >
          <VideoPlayer stream={localStream} isLocal={true} muted={true} />
          
          <div className="video-label">
            <span>You {isScreenSharing ? '(Screen)' : ''}</span>
          </div>

          <div className="video-status">
            {!mediaState.audio && <MicOff size={14} className="status-icon error" />}
            {!mediaState.video && !isScreenSharing && <VideoOff size={14} className="status-icon error" />}
          </div>

          {/* Hover Pin Button */}
          <button 
            className={`tile-pin-btn ${pinnedPeerId === 'local' ? 'pinned' : ''}`}
            onClick={(e) => handleTogglePin('local', e)}
            title={pinnedPeerId === 'local' ? "Unpin video" : "Pin video"}
          >
            {pinnedPeerId === 'local' ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        </div>

        {/* Remote Video Tiles */}
        {remoteSocketIds.map((id) => (
          <div 
            key={id} 
            className={`video-container ${activeFeaturedId === id ? 'is-featured' : ''} ${pinnedPeerId === id ? 'is-pinned' : ''}`}
            onDoubleClick={(e) => handleTogglePin(id, e)}
            title="Double-click to pin / unpin video"
          >
            <VideoPlayer stream={remoteStreams[id]} isLocal={false} muted={false} />
            
            <div className="video-label">
              <span>Peer {id.substring(0, 4)}</span>
            </div>

            {/* Hover Pin Button */}
            <button 
              className={`tile-pin-btn ${pinnedPeerId === id ? 'pinned' : ''}`}
              onClick={(e) => handleTogglePin(id, e)}
              title={pinnedPeerId === id ? "Unpin video" : "Pin video"}
            >
              {pinnedPeerId === id ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          </div>
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

