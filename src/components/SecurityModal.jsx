import React from 'react';
import { Shield, ShieldAlert, Lock, Hash } from 'lucide-react';

export default function SecurityModal({ isOpen, onClose, isSecure, fingerprint, roomName }) {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          {isSecure ? (
            <Shield size={48} className="success-icon" style={{color: '#4ade80', margin: '0 auto 16px'}} />
          ) : (
            <ShieldAlert size={48} className="warn-icon" style={{color: '#f87171', margin: '0 auto 16px'}} />
          )}
          <h2>{isSecure ? 'End-to-End Encrypted' : 'Unencrypted Room'}</h2>
          <p>{isSecure ? 'Your messages are secured with AES-256 encryption.' : 'Messages in this room are sent in plain text.'}</p>
        </div>
        
        <div className="security-details">
          <div className="detail-row">
            <Lock size={18} />
            <span>Room ID: <strong>{roomName}</strong></span>
          </div>
          
          {isSecure && fingerprint && (
            <div className="fingerprint-box">
              <div className="detail-row">
                <Hash size={18} />
                <span><strong>Security Fingerprint</strong></span>
              </div>
              <p className="helper-text">Compare this fingerprint with others in the room to verify your encryption keys match.</p>
              <div className="fingerprint-code">{fingerprint}</div>
            </div>
          )}
        </div>

        <button onClick={onClose} className="btn join-btn" style={{marginTop: '24px'}}>Close</button>
      </div>
    </div>
  );
}
