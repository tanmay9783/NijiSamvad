import React, { useRef, useEffect, useState } from 'react';
import { VolumeX } from 'lucide-react';

export default function VideoPlayer({ stream, isLocal, muted }) {
  const videoRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (!stream) {
      videoEl.srcObject = null;
      return;
    }

    videoEl.muted = Boolean(isLocal || muted);
    videoEl.srcObject = stream;

    const playVideo = () => {
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAutoplayBlocked(false);
          })
          .catch((err) => {
            console.warn("Autoplay attempt failed:", err);
            // If browser blocks unmuted autoplay, mute temporarily so video displays instead of showing black screen
            if (!isLocal && !videoEl.muted) {
              videoEl.muted = true;
              videoEl.play()
                .then(() => setAutoplayBlocked(true))
                .catch(e => console.warn("Muted playback fallback error:", e));
            }
          });
      }
    };

    playVideo();

    // Re-trigger play whenever tracks arrive, unmute, or load metadata
    const handleTrackEvent = () => playVideo();
    stream.addEventListener('addtrack', handleTrackEvent);
    stream.addEventListener('removetrack', handleTrackEvent);
    stream.getTracks().forEach(t => t.addEventListener('unmute', handleTrackEvent));
    videoEl.addEventListener('loadedmetadata', handleTrackEvent);

    return () => {
      stream.removeEventListener('addtrack', handleTrackEvent);
      stream.removeEventListener('removetrack', handleTrackEvent);
      stream.getTracks().forEach(t => t.removeEventListener('unmute', handleTrackEvent));
      videoEl.removeEventListener('loadedmetadata', handleTrackEvent);
    };
  }, [stream, isLocal, muted]);

  const handleUnmuteClick = (e) => {
    e.stopPropagation();
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.muted = false;
      videoEl.play()
        .then(() => setAutoplayBlocked(false))
        .catch(console.error);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted}
        className={`video-player ${isLocal ? 'local-video' : 'remote-video'}`}
      />
      {autoplayBlocked && !isLocal && (
        <button
          onClick={handleUnmuteClick}
          className="btn-small btn"
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 8px',
            borderRadius: '16px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            zIndex: 10
          }}
          title="Click to enable audio"
        >
          <VolumeX size={14} style={{ color: '#ef4444' }} /> Click to unmute
        </button>
      )}
    </div>
  );
}
