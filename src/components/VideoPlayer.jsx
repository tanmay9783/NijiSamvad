import React, { useRef, useEffect } from 'react';

export default function VideoPlayer({ stream, isLocal, muted }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
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
