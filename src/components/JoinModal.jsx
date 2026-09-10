import React, { useState } from 'react';
import { Shield, Server, Shuffle } from 'lucide-react';

export default function JoinModal({ onJoin, isConnecting, connectionError }) {
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [serverTarget, setServerTarget] = useState('local'); // local, remote, demo

  const generateRoom = () => {
    const adjectives = ['swift', 'silent', 'secure', 'neon', 'cyber', 'crystal'];
    const nouns = ['nexus', 'matrix', 'vault', 'phantom', 'echo', 'horizon'];
    const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
    setRoomName(`${random(adjectives)}-${random(nouns)}-${Math.floor(Math.random() * 9999)}`);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pswd = '';
    for (let i = 0; i < 16; i++) {
      pswd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pswd);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userName && roomName) {
      onJoin(userName, roomName, password, serverTarget);
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
              E2EE Security Key (Optional)
              <button type="button" onClick={generatePassword} className="btn-text btn-small"><Shuffle size={14}/> Generate</button>
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for unencrypted room" />
            {password && <small className="helper-text success">Encryption enabled (AES-256)</small>}
          </div>

          <button type="submit" className="btn join-btn" disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Join Secure Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
