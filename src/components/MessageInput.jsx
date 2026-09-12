import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Smile, Send, Paperclip, X } from 'lucide-react';

export default function MessageInput({ onSendMessage, disabled, onTyping, replyingTo, onCancelReply, users = [] }) {
  const [msg, setMsg] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState([]);
  
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target) && !e.target.closest('.emoji-btn')) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const adjustHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setMsg(val);
    adjustHeight();
    
    // Typing indicator
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }

    // Mention detection
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null) {
      const filtered = users.filter(u => u.username.toLowerCase().includes(mentionQuery.toLowerCase()));
      if (filtered.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionIndex(prev => (prev + 1) % filtered.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionIndex(prev => (prev - 1 + filtered.length) % filtered.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertMention(filtered[mentionIndex]);
          return;
        }
        if (e.key === 'Escape') {
          setMentionQuery(null);
          return;
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    
    if (e.key === 'Escape' && replyingTo) {
      onCancelReply();
    }
  };

  const insertMention = (user) => {
    const cursor = inputRef.current.selectionStart;
    const textBefore = msg.slice(0, cursor);
    const textAfter = msg.slice(cursor);
    
    const newTextBefore = textBefore.replace(/@\w*$/, `@${user.username} `);
    setMsg(newTextBefore + textAfter);
    setSelectedMentions(prev => {
      if (!prev.find(m => m.id === user.id)) return [...prev, { id: user.id, username: user.username }];
      return prev;
    });
    setMentionQuery(null);
    
    setTimeout(() => {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(newTextBefore.length, newTextBefore.length);
      adjustHeight();
    }, 0);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const finalMsg = msg.trim();
    if (finalMsg) {
      // Find actual mentions left in the text
      const finalMentions = selectedMentions.filter(m => finalMsg.includes(`@${m.username}`));
      
      const replyData = replyingTo ? {
        messageId: replyingTo.id,
        senderName: replyingTo.sender,
        preview: replyingTo.text
      } : null;

      onSendMessage(finalMsg, false, replyData, finalMentions);
      setMsg('');
      setSelectedMentions([]);
      setMentionQuery(null);
      if (inputRef.current) inputRef.current.style.height = 'auto';
      setShowEmoji(false);
      if (onTyping) onTyping(false);
    }
  };

  const onEmojiClick = (emojiObject) => {
    setMsg((prev) => prev + emojiObject.emoji);
    inputRef.current?.focus();
    setTimeout(adjustHeight, 0);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 9.5 * 1024 * 1024) {
      alert("Attachment must be smaller than 9.5MB");
      return;
    }
    const replyData = replyingTo ? {
      messageId: replyingTo.id,
      senderName: replyingTo.sender,
      preview: replyingTo.text
    } : null;
    
    onSendMessage(file, true, replyData, []);
    e.target.value = null; 
  };

  const filteredUsers = mentionQuery !== null 
    ? users.filter(u => u.username.toLowerCase().includes(mentionQuery.toLowerCase())) 
    : [];

  return (
    <div className="send">
      {replyingTo && (
        <div className="composer-reply-context">
          <div>
            <span style={{color: 'var(--accent)', fontWeight: 600, display: 'block'}}>Replying to {replyingTo.sender}</span>
            <span style={{color: 'var(--text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px'}}>
              {replyingTo.isImage ? '📎 Attachment' : replyingTo.text}
            </span>
          </div>
          <button className="close-btn" onClick={onCancelReply} title="Cancel reply"><X size={18} /></button>
        </div>
      )}
      
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <div className="mention-popover">
          {filteredUsers.map((u, i) => (
            <div 
              key={u.id} 
              className={`mention-option ${i === mentionIndex ? 'active' : ''}`}
              onClick={() => insertMention(u)}
            >
              <div className="avatar" style={{width: 24, height: 24, background: 'var(--accent)', fontSize: '0.65rem'}}>
                {u.username.substring(0,2).toUpperCase()}
              </div>
              {u.username}
            </div>
          ))}
        </div>
      )}

      {showEmoji && (
        <div className="emoji-picker-container" ref={pickerRef}>
          <EmojiPicker onEmojiClick={onEmojiClick} theme="auto" />
        </div>
      )}
      <form onSubmit={handleSubmit} id="send-container">
        <button type="button" className="emoji-btn" onClick={() => setShowEmoji(!showEmoji)} disabled={disabled} title="Add emoji">
          <Smile size={24} />
        </button>
        
        <label className="emoji-btn file-btn" title="Attach File">
           <input type="file" style={{display: 'none'}} onChange={handleImageUpload} disabled={disabled} />
           <Paperclip size={20} />
        </label>
        
        <textarea 
          ref={inputRef} 
          id="msginp" 
          placeholder="Type a secure message..." 
          value={msg} 
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled} 
          rows={1}
          style={{resize: 'none', overflowY: 'auto', minHeight: '44px'}}
        />
        
        <button className="btn btn-icon" type="submit" disabled={disabled || (!msg.trim() && !replyingTo)} title="Send message">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
