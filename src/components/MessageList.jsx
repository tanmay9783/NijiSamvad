import React, { useRef, useEffect } from 'react';

// Generates a consistent color for an avatar based on a string
const getAvatarColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.substring(0, 2).toUpperCase();
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Safe rendering of links without XSS
const renderTextSafely = (text) => {
  if (!text) return null;
  // Simple regex for URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
};

export default function MessageList({ messages, _currentUser }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Cleanup object URLs when messages change or component unmounts
    // to prevent memory leaks from URL.createObjectURL
    return () => {
      messages.forEach(msg => {
        if (msg.isImage && msg.text && msg.text.startsWith('blob:')) {
          URL.revokeObjectURL(msg.text);
        }
      });
    };
  }, [messages]);

  return (
    <div className="message-wrapper">
      <div className="container" ref={containerRef}>
        {messages.map((msg, index) => {
          if (msg.position === 'center') {
            return (
              <div key={msg.id || index} className="message center">
                <span>{msg.text}</span>
              </div>
            );
          }

          const isMe = msg.position === 'right';
          const avatarColor = getAvatarColor(msg.sender || '?');

          return (
            <div key={msg.id || index} className={`message-group ${isMe ? 'group-right' : 'group-left'}`}>
              {!isMe && (
                <div className="avatar" style={{ backgroundColor: avatarColor }}>
                  {getInitials(msg.sender)}
                </div>
              )}
              
              <div className={`message ${msg.position}`}>
                {!isMe && <div className="sender-name">{msg.sender}</div>}
                
                <div className="message-content">
                  {msg.isImage ? (
                    <img src={msg.text} alt="Attachment" className="message-image" />
                  ) : (
                    renderTextSafely(msg.text)
                  )}
                </div>
                
                <div className="message-footer">
                  <span className="timestamp">{formatTime(msg.timestamp)}</span>
                  {isMe && <span className="delivery-check">✓✓</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
