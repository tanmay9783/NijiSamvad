import React, { useState } from 'react';
import { Shield, Server, Shuffle, Copy, Check } from 'lucide-react';
import { generateSecureRoomSecret } from '../services/crypto';

export default function JoinModal({ onJoin, isConnecting, connectionError }) {
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomSecret, setRoomSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [serverTarget, setServerTarget] = useState(() => (
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'local'
      : 'remote'
  )); // local, remote, demo

  const generateRoom = () => {
    const adjectives = ['swift', 'silent', 'secure', 'neon', 'cyber', 'crystal'];
    const nouns = ['nexus', 'matrix', 'vault', 'phantom', 'echo', 'horizon'];
    const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
    setRoomName(`${random(adjectives)}-${random(nouns)}-${Math.floor(Math.random() * 9999)}`);
  };

  const handleGenerateSecret = () => {
    const newSecret = generateSecureRoomSecret();
    setRoomSecret(newSecret);
    setCopied(false);
  };

  const handleCopySecret = () => {
    if (roomSecret) {
      navigator.clipboard.writeText(roomSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userName && roomName && roomSecret) {
      onJoin(userName, roomName, roomSecret, serverTarget);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>SecureChat</h2>
          <p>End-to-End Encrypted Real-Time Communication</p>
        </div>
        
        {connectionError && (
          <div className="alert alert-error">
            {connectionError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="server-selector">
            <label className={`server-option ${serverTarget === 'local' ? 'active' : ''}`}>
              <input type="radio" name="server" checked={serverTarget === 'local'} onChange={() => setServerTarget('local')} />
              <Server size={16} /> Local Server
            </label>
            <label className={`server-option ${serverTarget === 'remote' ? 'active' : ''}`}>
              <input type="radio" name="server" checked={serverTarget === 'remote'} onChange={() => setServerTarget('remote')} />
              <Server size={16} /> Remote (Render)
            </label>
            <label className={`server-option ${serverTarget === 'demo' ? 'active' : ''}`}>
              <input type="radio" name="server" checked={serverTarget === 'demo'} onChange={() => setServerTarget('demo')} />
              <Shield size={16} /> Offline Demo
            </label>
          </div>

          <div className="input-group">
            <label>Your Name</label>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} required placeholder="Enter your display name" maxLength={30} />
          </div>

          <div className="input-group">
            <label>
              Room ID 
              <button type="button" onClick={generateRoom} className="btn-text btn-small"><Shuffle size={14}/> Generate</button>
            </label>
            <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} required placeholder="Enter or generate room ID" />
          </div>

          <div className="input-group">
            <label>
              Room Secret / E2EE Key (Required)
              <span className="btn-group-inline">
                <button type="button" onClick={handleGenerateSecret} className="btn-text btn-small"><Shuffle size={14}/> Generate Secret</button>
                {roomSecret && (
                  <button type="button" onClick={handleCopySecret} className="btn-text btn-small success-text">
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </span>
            </label>
            <input 
              type="password" 
              value={roomSecret} 
              onChange={(e) => setRoomSecret(e.target.value)} 
              required 
              placeholder="Enter or generate high-entropy room secret" 
            />
            {roomSecret ? (
              <small className="helper-text success">🔒 High-Entropy E2EE Active (AES-256-GCM). Share secret with room participants.</small>
            ) : (
              <small className="helper-text warning">⚠️ Secret required. The public room name is NEVER used as the encryption secret.</small>
            )}
          </div>

          <button type="submit" className="btn join-btn" disabled={isConnecting || !roomSecret}>
            {isConnecting ? 'Connecting...' : 'Join Encrypted Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
