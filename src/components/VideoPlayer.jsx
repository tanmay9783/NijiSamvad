import React, { useRef, useEffect } from 'react';

export default function VideoPlayer({ stream, isLocal, muted }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Video playback error or autoplay policy block:", err);
        });
      }
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal || muted}
      className={`video-player ${isLocal ? 'local-video' : 'remote-video'}`}
    />
  );
}
