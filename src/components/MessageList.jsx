import React, { useRef, useEffect, useState } from 'react';
import { Reply, Copy, MoreHorizontal } from 'lucide-react';

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

const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const formatDateSeparator = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function MessageList({ messages, _currentUser, onReply }) {
  const containerRef = useRef(null);
  const [swipeState, setSwipeState] = useState({ id: null, startX: 0, currentX: 0 });

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      messages.forEach(msg => {
        if (msg.isImage && msg.text && msg.text.startsWith('blob:')) {
          try { URL.revokeObjectURL(msg.text); } catch (e) { }
        }
      });
    };
  }, [messages]);

  const handlePointerDown = (e, msgId) => {
    if (e.pointerType === 'mouse') return;
    setSwipeState({ id: msgId, startX: e.clientX, currentX: 0 });
  };

  const handlePointerMove = (e, msg) => {
    if (swipeState.id !== msg.id) return;
    const diff = e.clientX - swipeState.startX;
    // only allow swipe towards opposite direction (left for right messages, right for left messages)
    const isMe = msg.position === 'right';
    if ((isMe && diff < 0) || (!isMe && diff > 0)) {
      if (Math.abs(diff) < 100) {
        setSwipeState(prev => ({ ...prev, currentX: diff }));
      }
    }
  };

  const handlePointerUp = (e, msg) => {
    if (swipeState.id === msg.id) {
      if (Math.abs(swipeState.currentX) > 50) {
        if (onReply) onReply(msg);
        try { if (navigator.vibrate) navigator.vibrate(50); } catch (e) { }
      }
      setSwipeState({ id: null, startX: 0, currentX: 0 });
    }
  };

  const handlePointerCancel = () => {
    setSwipeState({ id: null, startX: 0, currentX: 0 });
  };

  const scrollToOriginal = (msgId) => {
    const el = document.getElementById(msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-pulse');
      setTimeout(() => el.classList.remove('highlight-pulse'), 2000);
    }
  };

  const renderTextSafely = (text, mentions) => {
    if (!text) return null;
    let parts = [text];
    
    // Simple URL regex processing
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    if (mentions && mentions.length > 0) {
      mentions.forEach(m => {
        const regex = new RegExp(`(@${m.username})`, 'gi');
        parts = parts.flatMap(p => {
          if (typeof p !== 'string') return p;
          return p.split(regex);
        });
      });
    }

    return parts.map((part, i) => {
      if (typeof part !== 'string') return part;
      
      const isMention = mentions && mentions.find(m => `@${m.username}`.toLowerCase() === part.toLowerCase());
      if (isMention) {
        const isSelf = isMention.username === _currentUser;
        return <span key={i} className={`mention-tag ${isSelf ? 'mention-self' : ''}`}>{part}</span>;
      }
      
      const urlMatches = part.split(urlRegex);
      if (urlMatches.length > 1) {
        return <span key={i}>{urlMatches.map((u, j) => {
          if (u.match(urlRegex)) {
            return <a key={j} href={u} target="_blank" rel="noopener noreferrer" className="chat-link">{u}</a>;
          }
          return u;
        })}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  let lastDate = null;
  let lastSender = null;

  return (
    <div className="message-wrapper">
      <div className="container" ref={containerRef}>
        {messages.map((msg, index) => {
          const elements = [];
          
          if (msg.position === 'center') {
            lastSender = null;
            return (
              <div key={msg.id || index} className="message center" id={msg.id}>
                <span>{msg.text}</span>
              </div>
            );
          }

          const msgDate = new Date(msg.timestamp);
          const dateStr = formatDateSeparator(msg.timestamp);
          if (lastDate !== dateStr) {
            elements.push(
              <div key={`date-${index}`} className="date-separator">
                <span className="date-separator-text">{dateStr}</span>
              </div>
            );
            lastDate = dateStr;
            lastSender = null; // reset grouping on new day
          }

          const isMe = msg.position === 'right';
          const avatarColor = getAvatarColor(msg.sender || '?');
          const isGrouped = lastSender === msg.sender;
          lastSender = msg.sender;

          const transformStyle = swipeState.id === msg.id 
            ? { transform: `translateX(${swipeState.currentX}px)`, transition: 'none' } 
            : { transform: 'translateX(0)', transition: 'transform 0.2s' };

          elements.push(
            <div 
              key={msg.id || index} 
              className={`message-group ${isMe ? 'group-right' : 'group-left'}`}
              style={{ marginTop: isGrouped ? '-0.5rem' : '0' }}
            >
              {!isMe && (
                <div className="avatar" style={{ backgroundColor: avatarColor, opacity: isGrouped ? 0 : 1 }}>
                  {!isGrouped && getInitials(msg.sender)}
                </div>
              )}
              
              <div 
                className={`message ${msg.position}`} 
                id={msg.id}
                style={transformStyle}
                onPointerDown={(e) => handlePointerDown(e, msg.id)}
                onPointerMove={(e) => handlePointerMove(e, msg)}
                onPointerUp={(e) => handlePointerUp(e, msg)}
                onPointerCancel={handlePointerCancel}
                onPointerLeave={handlePointerCancel}
              >
                {!isMe && !isGrouped && <div className="sender-name">{msg.sender}</div>}
                
                {msg.replyTo && (
                  <div className="reply-preview-block" onClick={() => scrollToOriginal(msg.replyTo.messageId)}>
                    <span className="reply-sender">{msg.replyTo.senderName}</span>
                    <span className="reply-text">{msg.replyTo.preview}</span>
                  </div>
                )}
                
                <div className="message-content">
                  {msg.isImage ? (
                    <img src={msg.text} alt="Attachment" className="message-image" />
                  ) : (
                    renderTextSafely(msg.text, msg.mentions)
                  )}
                </div>
                
                <div className="message-footer">
                  <span className="timestamp">{formatTime(msg.timestamp)}</span>
                  {isMe && <span className="delivery-check">✓✓</span>}
                </div>
                
                <div className="message-actions-overlay">
                  <button className="icon-btn" title="Reply" onClick={() => onReply && onReply(msg)}>
                    <Reply size={14} />
                  </button>
                  {!msg.isImage && (
                    <button className="icon-btn" title="Copy" onClick={() => {
                      navigator.clipboard.writeText(msg.text);
                      const el = document.getElementById(msg.id);
                      if(el) { el.classList.add('highlight-pulse'); setTimeout(()=>el.classList.remove('highlight-pulse'), 1000); }
                    }}>
                      <Copy size={14} />
                    </button>
                  )}
                  <button className="icon-btn" title="More Actions">
                    <MoreHorizontal size={14} />
                  </button>
                </div>
                
                <Reply size={20} className="swipe-reply-icon" style={{
                  opacity: swipeState.id === msg.id && Math.abs(swipeState.currentX) > 20 ? 1 : 0
                }} />
              </div>
            </div>
          );
          
          return elements;
        })}
      </div>
    </div>
  );
}
