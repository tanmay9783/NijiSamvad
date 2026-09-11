import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { deriveKeys, encryptMessage, decryptMessage, generateRoomFingerprint, encryptAttachment, decryptAttachment } from './services/crypto';
import { playNotificationSound } from './services/sound';
import useWebRTC from './hooks/useWebRTC';
import JoinModal from './components/JoinModal';
import Header from './components/Header';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import UserDrawer from './components/UserDrawer';
import SecurityModal from './components/SecurityModal';
import CallInterface from './components/CallInterface';
import Toast from './components/Toast';
import IncomingCallModal from './components/IncomingCallModal';
import './index.css';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [isMuted, setIsMuted] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [authHash, setAuthHash] = useState('');
  const [roomFingerprint, setRoomFingerprint] = useState('');
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [users, setUsers] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  
  // Modals & Drawers
  const [showDrawer, setShowDrawer] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showChatInCall, setShowChatInCall] = useState(true);
  
  // Demo Mode state
  const [isDemoMode, setIsDemoMode] = useState(false);
  const demoIntervalRef = useRef(null);
  
  // Blob URL tracking for memory leak prevention
  const blobUrlsRef = useRef(new Set());

  // Track blob urls when messages change
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.isImage && msg.text && msg.text.startsWith('blob:')) {
        blobUrlsRef.current.add(msg.text);
      }
    });
  }, [messages]);

  // Cleanup ONLY on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
        try { URL.revokeObjectURL(url); } catch(e){}
      });
      blobUrlsRef.current.clear();
    };
  }, []);

  // WebRTC Call State Hook (Phase 11)
  const {
    callState,
    incomingCall,
    activeCallRoom,
    localStream,
    remoteStreams,
    mediaState,
    isScreenSharing,
    startCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo
  } = useWebRTC(socket, users);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const addMessage = useCallback((msgObject) => {
    setMessages((prev) => [...prev, msgObject]);
    if (msgObject.position !== 'right' && !isMuted && msgObject.position !== 'center') {
      playNotificationSound('receive');
    }
  }, [isMuted]);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  // Handle Demo Mode Bot
  useEffect(() => {
    if (isDemoMode && isJoined) {
      demoIntervalRef.current = setTimeout(() => {
        addMessage({
          id: Date.now(),
          text: `Hello ${userName}! I'm Ada, an offline demo bot. This room is securely simulated locally. Try sending a message or attaching an image!`,
          position: 'left',
          sender: 'Ada Lovelace',
          timestamp: new Date().toISOString()
        });
        setUsers([
          { username: userName, id: '1' },
          { username: 'Ada Lovelace', id: '2' }
        ]);
      }, 1500);
    }
    return () => clearTimeout(demoIntervalRef.current);
  }, [isDemoMode, isJoined, userName, addMessage]);

  const activeServerUrlRef = useRef('');

  const handleJoin = async (name, room, secret, target) => {
    setIsConnecting(true);
    setConnectionError('');
    setRoomName(room);
    setUserName(name);

    if (!secret || secret.trim() === '') {
      setIsConnecting(false);
      setConnectionError('Room Secret / E2EE Security Key is required for encrypted communication.');
      return;
    }

    let finalEncryptionKey = null;
    let authHash = null;

    try {
      const keys = await deriveKeys(secret, room);
      finalEncryptionKey = keys.encryptionKey;
      authHash = keys.authHash;
      setEncryptionKey(finalEncryptionKey);
      setAuthHash(authHash);
      
      const fingerprint = await generateRoomFingerprint(room, secret);
      setRoomFingerprint(fingerprint);
    } catch (err) {
      setIsConnecting(false);
      setConnectionError('Failed to derive encryption key from Room Secret.');
      return;
    }

    if (target === 'demo') {
      setTimeout(() => {
        setIsDemoMode(true);
        setIsJoined(true);
        setIsConnecting(false);
        setUsers([{ username: name, id: '1' }]);
        addToast('Joined Demo Room', 'success');
        addMessage({
          text: `Welcome to the Offline Demo Room, ${name}.`,
          position: 'center'
        });
      }, 500);
      return;
    }

    const serverUrl = target === 'local' 
      ? 'http://localhost:5000' 
      : (import.meta.env.VITE_API_URL || window.location.origin);
    
    activeServerUrlRef.current = serverUrl === window.location.origin ? '' : serverUrl;

    try {
      const newSocket = io(serverUrl, { 
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnectionAttempts: 3
      });
      
      newSocket.on('connect', () => {
        setSocket(newSocket);
        newSocket.emit('new-user-joined', { userName: name, roomName: room, authHash });
      });

      newSocket.on('connect_error', (err) => {
        setIsConnecting(false);
        setConnectionError(`Connection failed: ${err.message}. Try another server.`);
        newSocket.close();
      });

      newSocket.on('join-success', (data) => {
        setIsJoined(true);
        setIsConnecting(false);
        addToast(`Joined ${data.room}`, 'success');
        addMessage({
          text: `Welcome to SecureChat, ${data.username}. You've joined ${data.room}`,
          position: 'center'
        });
      });

      newSocket.on('join-error', (err) => {
        setIsConnecting(false);
        setConnectionError(err);
        newSocket.close();
      });

      newSocket.on('user-joined', (joinedName) => {
        addMessage({ text: `${joinedName} joined the room`, position: 'center' });
        addToast(`${joinedName} joined`, 'info');
      });

      newSocket.on('left', (leftName) => {
        addMessage({ text: `${leftName} left the room`, position: 'center' });
      });

      newSocket.on('room-users', (usersList) => {
        setUsers(usersList);
      });

      newSocket.on('receive', async (payload) => {
        let rawContent = payload.message;
        let decryptedStr = rawContent;
        let isImage = false;
        
        if (finalEncryptionKey) {
          try {
            decryptedStr = await decryptMessage(rawContent, finalEncryptionKey);
          } catch (err) {
            addMessage({
              id: payload.id,
              text: "🔒 [Encrypted message - Key mismatch or malformed]",
              position: 'left',
              sender: payload.name,
              timestamp: payload.timestamp,
              isImage: false
            });
            return;
          }
        } else {
          addMessage({
            id: payload.id,
            text: "🔒 [Encrypted message - Encryption key missing]",
            position: 'left',
            sender: payload.name,
            timestamp: payload.timestamp,
            isImage: false
          });
          return;
        }
        
        // Parse protocol JSON envelope
        let finalMessage = decryptedStr;
        try {
          const msgObj = JSON.parse(decryptedStr);
          if (msgObj && msgObj.version === 1) {
            if (msgObj.type === 'text') {
              finalMessage = msgObj.text;
            } else if (msgObj.type === 'attachment') {
              isImage = true;
              const apiBase = activeServerUrlRef.current || (import.meta.env.VITE_API_URL || '');
              const res = await fetch(`${apiBase}/api/attachments/${msgObj.attachmentId}`, {
                headers: {
                  'x-room-name': room,
                  'x-auth-hash': authHash || ''
                }
              });
              if (!res.ok) throw new Error("Download failed");
              const encryptedBlob = await res.blob();
              const decryptedBlob = await decryptAttachment(encryptedBlob, msgObj.attachmentKey, msgObj.iv);
              finalMessage = URL.createObjectURL(decryptedBlob);
            }
          }
        } catch (jsonErr) {
          if (decryptedStr.startsWith('data:image/')) isImage = true;
        }
        
        addMessage({
          id: payload.id,
          text: finalMessage,
          position: 'left',
          sender: payload.name,
          timestamp: payload.timestamp,
          isImage
        });
      });

      newSocket.on('chat-cleared', (clearerName) => {
        setMessages([]);
        addMessage({ text: `${clearerName} cleared the room history`, position: 'center' });
      });

    } catch {
      setIsConnecting(false);
      setConnectionError('Failed to initialize connection.');
    }
  };

  const handleSendMessage = async (msgTextOrFile, isImage = false) => {
    let payloadContent;
    let localPreview = null;
    
    if (isImage) {
      // It's a File object
      const file = msgTextOrFile;
      localPreview = URL.createObjectURL(file);
      
      if (file.size > 9.5 * 1024 * 1024) {
        addToast('File too large. Maximum size is 9.5MB before encryption.', 'error');
        return;
      }

      if (!encryptionKey) {
        addToast('Cannot send attachments without an encryption key.', 'error');
        return;
      }
      
      try {
        addToast('Encrypting and uploading...', 'info');
        const { ciphertextBlob, attachmentKeyStr, ivStr } = await encryptAttachment(file);
        
        const apiBase = activeServerUrlRef.current || (import.meta.env.VITE_API_URL || '');
        const uploadRes = await fetch(`${apiBase}/api/attachments`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/octet-stream',
            'x-room-name': roomName,
            'x-auth-hash': authHash || ''
          },
          body: ciphertextBlob
        });
        
        if (!uploadRes.ok) throw new Error('Upload failed');
        const { id } = await uploadRes.json();
        
        payloadContent = JSON.stringify({
          version: 1,
          type: 'attachment',
          attachmentId: id,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          attachmentKey: attachmentKeyStr,
          iv: ivStr
        });
      } catch (err) {
        addToast('Failed to send attachment', 'error');
        return;
      }
    } else {
      // Text message
      payloadContent = JSON.stringify({
        version: 1,
        type: 'text',
        text: msgTextOrFile
      });
      localPreview = msgTextOrFile;
    }
    
    let finalContent = payloadContent;
    if (encryptionKey) {
      try {
        finalContent = await encryptMessage(payloadContent, encryptionKey);
      } catch (err) {
        addToast('Encryption failed. Message not sent.', 'error');
        return;
      }
    }
    
    const msgId = `msg_${Date.now()}`;

    addMessage({
      id: msgId,
      text: localPreview,
      position: 'right',
      sender: userName,
      timestamp: new Date().toISOString(),
      isImage
    });

    if (!isMuted) playNotificationSound('send');

    if (isDemoMode) {
      setTimeout(() => {
        addMessage({
          id: Date.now(),
          text: isImage ? 'Nice picture! 📸' : `I received: "${msgTextOrFile}"`,
          position: 'left',
          sender: 'Ada Lovelace',
          timestamp: new Date().toISOString()
        });
      }, 1000);
      return;
    }

    if (socket) {
      socket.emit('send', { id: msgId, content: finalContent });
    }
  };

  const handleTyping = (isTyping) => {
    if (socket && !isDemoMode) {
      socket.emit('typing', isTyping);
    }
  };

  const leaveChat = () => {
    if (socket) {
      socket.emit('leave-room');
      socket.close();
      setSocket(null);
    }
    setIsJoined(false);
    setIsDemoMode(false);
    endCall();

    messages.forEach(msg => {
      if (msg.isImage && msg.text && msg.text.startsWith('blob:')) {
        try { URL.revokeObjectURL(msg.text); } catch(e){}
      }
    });
    blobUrlsRef.current.clear();
    
    setMessages([]);
    setUsers([]);
    setEncryptionKey('');
    setAuthHash('');
    setRoomFingerprint('');
    setRoomName('');
    setUserName('');
    addToast('Left the chat room', 'info');
  };

  const handleStartCall = () => {
    if (isDemoMode) {
      addToast('WebRTC Calls are not available in Offline Demo mode.', 'error');
      return;
    }
    startCall();
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      try {
        await startScreenShare();
      } catch (err) {
        addToast(err.message || 'Screen sharing not allowed or unsupported', 'error');
      }
    }
  };

  const isInCall = callState === 'outgoing' || callState === 'connecting' || callState === 'connected';

  return (
    <div className="app">
      <Toast toasts={toasts} removeToast={removeToast} />
      
      {!isJoined ? (
        <JoinModal onJoin={handleJoin} isConnecting={isConnecting} connectionError={connectionError} />
      ) : (
        <>
          <Header 
            theme={theme} 
            onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            isJoined={isJoined}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(prev => !prev)}
            onLeaveChat={leaveChat}
            roomName={roomName}
            memberCount={users.length}
            onOpenDrawer={() => setShowDrawer(true)}
            onOpenSecurity={() => setShowSecurity(true)}
            isSecure={!!encryptionKey}
            callState={callState}
            activeCallRoom={activeCallRoom}
            onStartCall={handleStartCall}
            onAcceptCall={acceptCall}
            onEndCall={endCall}
          />
          
          <UserDrawer 
            isOpen={showDrawer} 
            onClose={() => setShowDrawer(false)} 
            users={users} 
            currentUser={userName} 
          />
          
          <SecurityModal 
            isOpen={showSecurity} 
            onClose={() => setShowSecurity(false)} 
            isSecure={!!encryptionKey} 
            fingerprint={roomFingerprint}
            roomName={roomName}
          />

          <IncomingCallModal 
            incomingCall={incomingCall}
            onAccept={() => acceptCall()}
            onDecline={declineCall}
          />

          {isInCall && (
            <CallInterface 
              callState={callState}
              localStream={localStream}
              remoteStreams={remoteStreams}
              mediaState={mediaState}
              isScreenSharing={isScreenSharing}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
              onToggleScreenShare={handleToggleScreenShare}
              onCancelCall={cancelCall}
              onEndCall={endCall}
              showChat={showChatInCall}
              onToggleChat={() => setShowChatInCall(prev => !prev)}
            />
          )}

          {(!isInCall || showChatInCall) && (
            <>
              <MessageList messages={messages} _currentUser={userName} />
              <MessageInput onSendMessage={handleSendMessage} onTyping={handleTyping} />
            </>
          )}
        </>
      )}
    </div>
  );
}
