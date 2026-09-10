import React from 'react';
import { X, User } from 'lucide-react';

export default function UserDrawer({ isOpen, onClose, users, currentUser }) {
  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose}></div>}
      <div className={`drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Room Members ({users.length})</h3>
          <button onClick={onClose} className="icon-btn"><X size={20} /></button>
        </div>
        <div className="drawer-content">
          <ul className="user-list">
            {users.map((u, i) => (
              <li key={i} className="user-item">
                <div className="user-avatar">
                  <User size={16} />
                </div>
                <div className="user-details">
                  <span className="user-name">{u.username} {u.username === currentUser && '(You)'}</span>
                  <span className="user-status">Online</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
