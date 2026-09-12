import React, { useState } from 'react';
import { Moon, Sun, Shield, ShieldAlert, LogOut, Volume2, VolumeX, Users, PhoneCall, PhoneOff, MoreVertical } from 'lucide-react';

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
  callState,
  activeCallRoom,
  onStartCall,
  onAcceptCall,
  onEndCall
}) {
  const isInCall = callState === 'outgoing' || callState === 'connecting' || callState === 'connected';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="header">
      <div className="header-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/logo-icon.png" alt="NijiSamvad Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <h1 className="header-logo">NijiSamvad</h1>
        </div>
        {isJoined && (
          <div className="room-info">
            <span className="room-name">#{roomName}</span>
            <button className="badge-btn member-count" onClick={onOpenDrawer} title="View Members">
              <Users size={14} /> <span className="hide-on-mobile">{memberCount}</span>
            </button>
            <button className={`badge-btn security-badge ${isSecure ? 'secure' : 'insecure'}`} onClick={onOpenSecurity} title="Security Info">
              {isSecure ? <Shield size={14} /> : <ShieldAlert size={14} />}
              <span className="hide-on-mobile">{isSecure ? 'End-to-end encrypted' : 'Unencrypted'}</span>
            </button>
          </div>
        )}
      </div>
      
      {isJoined && (
        <div className="header-right">
          {/* Active Call indicator for late room joiners */}
          {activeCallRoom && !isInCall && callState === 'idle' && (
            <button className="btn-call-join" onClick={() => onAcceptCall(null)} title="Join Active Call">
              <PhoneCall size={16} /> <span className="hide-on-mobile">Join Call</span>
            </button>
          )}

          <div className={`header-actions ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <button 
              className={`icon-btn ${isInCall ? 'call-active' : ''}`} 
              onClick={isInCall ? onEndCall : onStartCall} 
              title={isInCall ? "Leave Call" : "Start Video Call"}
            >
              {isInCall ? <PhoneOff size={20} className="danger-text" /> : <PhoneCall size={20} className="success-text" />}
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
          
          <button className="icon-btn mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <MoreVertical size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
