import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';

export default function IncomingCallModal({ incomingCall, onAccept, onDecline }) {
  if (!incomingCall) return null;

  return (
    <div className="modal incoming-call-modal">
      <div className="modal-content call-invite-card" style={{ padding: '3rem 2rem', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-xl)' }}>
        <div className="call-invite-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="pulse-ring" style={{ width: '80px', height: '80px', background: 'rgba(99, 102, 241, 0.15)' }}>
            <div className="avatar" style={{ width: '60px', height: '60px', fontSize: '1.5rem', background: 'var(--primary)' }}>
              {incomingCall.callerName ? incomingCall.callerName.substring(0, 2).toUpperCase() : '?'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{incomingCall.callerName}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Incoming secure video call...</p>
          </div>
        </div>

        <div className="call-invite-actions" style={{ gap: '1.5rem', padding: '0 1rem' }}>
          <button className="btn btn-decline" onClick={onDecline} title="Decline Call" style={{ borderRadius: 'var(--radius-xl)', padding: '1rem' }}>
            <PhoneOff size={20} />
          </button>
          <button className="btn btn-accept" onClick={onAccept} title="Accept Call" style={{ borderRadius: 'var(--radius-xl)', padding: '1rem', background: 'var(--success)' }}>
            <Phone size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
