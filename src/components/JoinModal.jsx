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
      <div className="modal-content" style={{ padding: '2.5rem' }}>
        <div className="modal-header" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <img src="/logo-icon.png" alt="NijiSamvad Logo" style={{ width: '64px', height: '64px', margin: '0 auto 0.75rem auto', display: 'block', objectFit: 'contain' }} />
          <h2 style={{ fontSize: '1.75rem', letterSpacing: '-0.5px', marginBottom: '0.75rem' }}>NijiSamvad</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Private conversations. No permanent history.<br/>
            All messages and calls are end-to-end encrypted.
          </p>
        </div>
        
        {connectionError && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            {connectionError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="server-selector" style={{ display: 'none' }}>
            {/* Kept functionally intact but hidden for premium UX, defaults to local/remote gracefully via state */}
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
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} required placeholder="Enter your display name" maxLength={30} style={{ padding: '0.85rem 1rem' }} />
          </div>

          <div className="input-group">
            <label>
              Room ID 
              <button type="button" onClick={generateRoom} className="btn-text btn-small"><Shuffle size={14}/> Generate</button>
            </label>
            <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} required placeholder="Enter or generate room ID" style={{ padding: '0.85rem 1rem' }} />
          </div>

          <div className="input-group">
            <label>
              Room Secret 
              <span className="btn-group-inline">
                <button type="button" onClick={handleGenerateSecret} className="btn-text btn-small"><Shuffle size={14}/> Generate</button>
                {roomSecret && (
                  <button type="button" onClick={handleCopySecret} className="btn-text btn-small success-text">
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                value={roomSecret} 
                onChange={(e) => setRoomSecret(e.target.value)} 
                required 
                placeholder="Enter or generate high-entropy room secret" 
                style={{ padding: '0.85rem 1rem', width: '100%' }}
              />
            </div>
            {roomSecret ? (
              <small className="helper-text success" style={{ marginTop: '0.25rem' }}>🔒 High-Entropy E2EE Active (AES-256-GCM).</small>
            ) : (
              <small className="helper-text" style={{ marginTop: '0.25rem' }}>A unique secret ensures your room remains perfectly private.</small>
            )}
          </div>

          <button type="submit" className="btn join-btn" disabled={isConnecting || !roomSecret} style={{ marginTop: '1rem', padding: '1rem', fontSize: '1rem' }}>
            {isConnecting ? 'Connecting securely...' : 'Join Encrypted Room'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Crafted with ❤️ by <strong style={{ color: 'var(--primary)' }}>Tanmay</strong>
        </div>
      </div>
    </div>
  );
}
