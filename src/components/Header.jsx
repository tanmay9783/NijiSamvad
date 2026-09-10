import React from 'react';
import { Moon, Sun, Shield, ShieldAlert, LogOut, Volume2, VolumeX, Users, PhoneCall, PhoneOff } from 'lucide-react';

export default function Header({ 
  theme, onToggleTheme, 
  isJoined, 
  isMuted, onToggleMute, 
  onLeaveChat,
  roomName,
  memberCount,
  onOpenDrawer,
  onOpenSecurity,
  isSecure,
  isCallActive,
  onToggleCall
}) {
  return (
    <div className="logo header">
      <div className="logo-content">
        <h1>SecureChat</h1>
        {isJoined && (
          <div className="room-info">
            <span className="room-badge">{roomName}</span>
            <button className="badge-btn member-count" onClick={onOpenDrawer} title="View Members">
              <Users size={14} /> {memberCount}
            </button>
            <button className={`badge-btn security-badge ${isSecure ? 'secure' : 'insecure'}`} onClick={onOpenSecurity} title="Security Info">
              {isSecure ? <Shield size={14} /> : <ShieldAlert size={14} />}
              {isSecure ? 'E2EE Active' : 'Unencrypted'}
            </button>
          </div>
        )}
      </div>
      
      {isJoined && (
        <div className="header-actions">
          <button className={`icon-btn ${isCallActive ? 'call-active' : ''}`} onClick={onToggleCall} title={isCallActive ? "End Call" : "Start Video Call"}>
            {isCallActive ? <PhoneOff size={20} className="danger-text" /> : <PhoneCall size={20} className="success-text" />}
          </button>
          <button className="icon-btn" onClick={onToggleMute} title={isMuted ? "Unmute Notifications" : "Mute Notifications"}>
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button className="icon-btn" onClick={onToggleTheme} title="Toggle Theme">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="icon-btn danger" onClick={onLeaveChat} title="Leave Chat">
            <LogOut size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
