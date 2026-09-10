import React from 'react';
import VideoPlayer from './VideoPlayer';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export default function CallInterface({ 
  localStream, 
  remoteStreams, 
  mediaState, 
  onToggleAudio, 
  onToggleVideo, 
  onEndCall 
}) {
  const remoteSocketIds = Object.keys(remoteStreams);

  return (
    <div className="call-interface">
      <div className="video-grid">
        {/* Local Video */}
        <div className="video-container local-container">
          <VideoPlayer stream={localStream} isLocal={true} muted={true} />
          <div className="video-label">You</div>
          <div className="video-status">
            {!mediaState.audio && <MicOff size={14} className="status-icon error" />}
            {!mediaState.video && <VideoOff size={14} className="status-icon error" />}
          </div>
        </div>

        {/* Remote Videos */}
        {remoteSocketIds.map((id) => (
          <div key={id} className="video-container">
            <VideoPlayer stream={remoteStreams[id]} isLocal={false} muted={false} />
            <div className="video-label">Peer {id.substring(0,4)}</div>
          </div>
        ))}
      </div>

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
          className="control-btn end-call" 
          onClick={onEndCall}
          title="End Call"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}
