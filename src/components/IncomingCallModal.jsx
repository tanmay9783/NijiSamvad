import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';

export default function IncomingCallModal({ incomingCall, onAccept, onDecline }) {
  if (!incomingCall) return null;

  return (
    <div className="modal incoming-call-modal">
      <div className="modal-content call-invite-card">
        <div className="call-invite-header">
          <div className="pulse-ring">
            <Phone size={28} className="success-text" />
          </div>
          <h3>Incoming Call</h3>
          <p><strong>{incomingCall.callerName}</strong> is inviting you to a secure video call.</p>
        </div>

        <div className="call-invite-actions">
          <button className="btn btn-decline" onClick={onDecline} title="Decline Call">
            <PhoneOff size={18} /> Decline
          </button>
          <button className="btn btn-accept" onClick={onAccept} title="Accept Call">
            <Phone size={18} /> Accept
          </button>
        </div>
      </div>
    </div>
  );
}
