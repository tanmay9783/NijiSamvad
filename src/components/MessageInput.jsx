import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Smile, Send, Paperclip } from 'lucide-react';

export default function MessageInput({ onSendMessage, disabled, onTyping }) {
  const [msg, setMsg] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
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

  const handleChange = (e) => {
    setMsg(e.target.value);
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (msg.trim()) {
      onSendMessage(msg.trim());
      setMsg('');
      setShowEmoji(false);
      if (onTyping) onTyping(false);
    }
  };

  const onEmojiClick = (emojiObject) => {
    setMsg((prev) => prev + emojiObject.emoji);
    inputRef.current?.focus();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Attachment must be smaller than 10MB");
      return;
    }
    onSendMessage(file, true);
    e.target.value = null; // reset input
  };

  return (
    <div className="send">
      {showEmoji && (
        <div className="emoji-picker-container" ref={pickerRef}>
          <EmojiPicker onEmojiClick={onEmojiClick} theme="auto" />
        </div>
      )}
      <form onSubmit={handleSubmit} id="send-container">
        <button type="button" className="emoji-btn" onClick={() => setShowEmoji(!showEmoji)} disabled={disabled} title="Add emoji">
          <Smile size={24} />
        </button>
        
        <label className="emoji-btn file-btn" title="Attach Image">
           <input type="file" accept="image/*" style={{display: 'none'}} onChange={handleImageUpload} disabled={disabled} />
           <Paperclip size={20} />
        </label>
        
        <input 
          ref={inputRef} 
          type="text" 
          id="msginp" 
          placeholder="Type a secure message..." 
          autoComplete="off" 
          value={msg} 
          onChange={handleChange} 
          disabled={disabled} 
        />
        
        <button className="btn btn-icon" type="submit" disabled={disabled || !msg.trim()} title="Send message">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
