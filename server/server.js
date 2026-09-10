import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();

// Storage Abstraction (Local file system for dev, can be replaced by S3)
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// id -> { roomId, filePath, createdAt }
const attachmentMeta = new Map();

const attachmentStore = {
  async upload(data, roomId) {
    const id = crypto.randomUUID();
    const filePath = path.join(UPLOADS_DIR, `${id}.bin`);
    await fs.promises.writeFile(filePath, data);
    attachmentMeta.set(id, { roomId, filePath, createdAt: Date.now() });
    return id;
  },
  async get(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('Invalid attachment ID format');
    }
    const meta = attachmentMeta.get(id);
    if (!meta) throw new Error('Attachment not found');
    return await fs.promises.readFile(meta.filePath);
  },
  async deleteRoomAttachments(roomId) {
    for (const [id, meta] of attachmentMeta.entries()) {
      if (meta.roomId === roomId) {
        try {
          if (fs.existsSync(meta.filePath)) {
            await fs.promises.unlink(meta.filePath);
          }
        } catch (e) {
          console.error(`Failed to delete attachment ${id}:`, e.message);
        }
        attachmentMeta.delete(id);
      }
    }
  },
  getMeta(id) {
    return attachmentMeta.get(id);
  },
  // Periodic cleanup of orphaned attachments
  async cleanupOrphans(activeRooms) {
    const now = Date.now();
    const TTL = 24 * 60 * 60 * 1000; // 24 hours
    for (const [id, meta] of attachmentMeta.entries()) {
      // If room no longer exists or TTL expired
      if (!activeRooms.has(meta.roomId) || (now - meta.createdAt > TTL)) {
        try {
          if (fs.existsSync(meta.filePath)) {
            await fs.promises.unlink(meta.filePath);
          }
        } catch (e) {
          console.error(`Failed to cleanup orphan attachment ${id}:`, e.message);
        }
        attachmentMeta.delete(id);
      }
    }
  }
};

app.use(helmet({
  contentSecurityPolicy: false 
}));

const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/attachments', express.raw({ type: 'application/octet-stream', limit: '10mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

// State Management Abstractions
const roomsMap = new Map(); 

const roomStore = {
  createRoom(roomName, authHash) {
    if (!roomsMap.has(roomName)) {
      roomsMap.set(roomName, {
        authHash: authHash || null,
        users: new Map()
      });
    }
    return roomsMap.get(roomName);
  },
  getRoom(roomName) {
    return roomsMap.get(roomName);
  },
  addUser(roomName, socketId, userData) {
    const room = roomsMap.get(roomName);
    if (room) {
      room.users.set(socketId, userData);
    }
  },
  removeUser(roomName, socketId) {
    const room = roomsMap.get(roomName);
    if (room) {
      room.users.delete(socketId);
    }
  },
  hasUser(roomName, socketId) {
    const room = roomsMap.get(roomName);
    return room ? room.users.has(socketId) : false;
  },
  validateCredential(roomName, authHash) {
    const room = roomsMap.get(roomName);
    if (room && room.authHash) {
      return room.authHash === authHash;
    }
    return true; // No auth hash required or new room
  },
  getUserCount() {
    return Array.from(roomsMap.values()).reduce((acc, room) => acc + room.users.size, 0);
  },
  getRoomCount() {
    return roomsMap.size;
  },
  getUsersArray(roomName) {
    const room = roomsMap.get(roomName);
    return room ? Array.from(room.users.values()) : [];
  },
  destroyRoom(roomName) {
    roomsMap.delete(roomName);
  },
  getAllRooms() {
    return roomsMap;
  }
};

const rateLimitsMap = new Map();
const RATE_LIMIT_WINDOW = 5000;
const RATE_LIMITS = {
  send: 10,
  typing: 5,
  reaction: 10,
  webrtc: 50
};

const rateLimitStore = {
  check(socketId, action) {
    if (!rateLimitsMap.has(socketId)) rateLimitsMap.set(socketId, new Map());
    const userLimits = rateLimitsMap.get(socketId);
    if (!userLimits.has(action)) userLimits.set(action, { count: 0, windowStart: Date.now() });
    
    const state = userLimits.get(action);
    const now = Date.now();
    if (now - state.windowStart > RATE_LIMIT_WINDOW) {
      state.count = 1;
      state.windowStart = now;
      return true;
    }
    state.count++;
    return state.count <= RATE_LIMITS[action];
  },
  cleanup(socketId) {
    rateLimitsMap.delete(socketId);
  }
};

// Periodic Orphan Cleanup
setInterval(() => {
  attachmentStore.cleanupOrphans(roomStore.getAllRooms());
}, 60 * 60 * 1000); // 1 hour

// Config Limits
const LIMITS = {
  USERNAME: 50,
  ROOMNAME: 100,
  AUTHHASH: 256,
  MESSAGE_ID: 100,
  MESSAGE_CONTENT: 256 * 1024, // Reduced to 256KB
  EMOJI: 20,
  SDP: 20480, 
};

// Destroys all room state explicitly
async function destroyRoomIfEmpty(roomName) {
  const room = roomStore.getRoom(roomName);
  if (room && room.users.size === 0) {
    await attachmentStore.deleteRoomAttachments(roomName);
    roomStore.destroyRoom(roomName);
  }
}

// HTTP Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  res.status(200).json({
    rooms: roomStore.getRoomCount(),
    users: roomStore.getUserCount()
  });
});

app.post('/api/attachments', async (req, res) => {
  try {
    const roomName = req.headers['x-room-name'];
    const authHash = req.headers['x-auth-hash'];
    
    if (!roomName || !roomStore.getRoom(roomName)) {
      return res.status(401).json({ error: 'Unauthorized or room destroyed' });
    }
    if (!roomStore.validateCredential(roomName, authHash)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty body' });
    }
    const id = await attachmentStore.upload(req.body, roomName);
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/attachments/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const roomName = req.headers['x-room-name'];
    const authHash = req.headers['x-auth-hash'];

    const meta = attachmentStore.getMeta(id);
    if (!meta) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    if (meta.roomId !== roomName) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!roomStore.getRoom(roomName) || !roomStore.validateCredential(roomName, authHash)) {
       return res.status(401).json({ error: 'Unauthorized or room destroyed' });
    }

    const data = await attachmentStore.get(id);
    res.set('Content-Type', 'application/octet-stream');
    res.send(data);
  } catch (error) {
    res.status(404).json({ error: 'Not found' });
  }
});


io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('new-user-joined', (payload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        return socket.emit('join-error', 'Unable to join room.');
      }

      const { userName, roomName, authHash } = payload;

      if (typeof userName !== 'string' || userName.trim().length === 0 || userName.length > LIMITS.USERNAME) {
        return socket.emit('join-error', 'Unable to join room.');
      }
      if (typeof roomName !== 'string' || roomName.trim().length === 0 || roomName.length > LIMITS.ROOMNAME) {
        return socket.emit('join-error', 'Unable to join room.');
      }
      if (authHash !== undefined && authHash !== null && (typeof authHash !== 'string' || authHash.length > LIMITS.AUTHHASH)) {
        return socket.emit('join-error', 'Unable to join room.');
      }

      const cleanUserName = userName.trim();
      const cleanRoomName = roomName.trim();

      roomStore.createRoom(cleanRoomName, authHash);

      if (!roomStore.validateCredential(cleanRoomName, authHash)) {
        return socket.emit('join-error', 'Unable to join room.');
      }

      if (currentRoom) {
        const prevRoom = currentRoom;
        socket.leave(currentRoom);
        roomStore.removeUser(currentRoom, socket.id);
        io.to(currentRoom).emit('left', currentUser);
        io.to(currentRoom).emit('room-users', roomStore.getUsersArray(currentRoom));
        destroyRoomIfEmpty(prevRoom);
      }

      socket.join(cleanRoomName);
      currentRoom = cleanRoomName;
      currentUser = cleanUserName;

      const userData = { id: socket.id, username: cleanUserName, joinedAt: Date.now() };
      roomStore.addUser(cleanRoomName, socket.id, userData);

      socket.emit('join-success', { username: cleanUserName, room: cleanRoomName });
      socket.to(cleanRoomName).emit('user-joined', cleanUserName);
      io.to(cleanRoomName).emit('room-users', roomStore.getUsersArray(cleanRoomName));
      
    } catch (error) {
      socket.emit('join-error', 'Unable to join room.');
    }
  });

  socket.on('send', (messagePayload) => {
    try {
      if (!currentRoom) return;
      if (!rateLimitStore.check(socket.id, 'send')) return;
      if (!messagePayload || typeof messagePayload !== 'object') return;

      const content = messagePayload.content;
      if (typeof content !== 'string' || content.length > LIMITS.MESSAGE_CONTENT) return;

      const payload = {
        id: crypto.randomUUID(),
        message: content, 
        name: currentUser,
        timestamp: new Date().toISOString()
      };

      socket.to(currentRoom).emit('receive', payload);
    } catch (e) {}
  });
  
  socket.on('typing', (isTyping) => {
    try {
      if (!currentRoom) return;
      if (!rateLimitStore.check(socket.id, 'typing')) return;
      if (typeof isTyping !== 'boolean') return;

      socket.to(currentRoom).emit('user-typing', { user: currentUser, isTyping });
    } catch (e) {}
  });
  
  socket.on('message-reaction', (payload) => {
    try {
      if (!currentRoom) return;
      if (!rateLimitStore.check(socket.id, 'reaction')) return;
      if (!payload || typeof payload !== 'object') return;

      const { messageId, emoji } = payload;
      if (typeof messageId !== 'string' || messageId.length > LIMITS.MESSAGE_ID) return;
      if (typeof emoji !== 'string' || emoji.length > LIMITS.EMOJI) return;

      socket.to(currentRoom).emit('reaction-added', { 
        messageId, 
        emoji, 
        user: currentUser 
      });
    } catch (e) {}
  });

  socket.on('clear-chat', () => {
    try {
      if (!currentRoom) return;
      if (!rateLimitStore.check(socket.id, 'send')) return; 
      io.to(currentRoom).emit('chat-cleared', currentUser);
    } catch (e) {}
  });
  
  const validateWebrtcAuth = (targetSocketId) => {
    if (!currentRoom) return false;
    return roomStore.hasUser(currentRoom, targetSocketId);
  };

  socket.on('webrtc-offer', (payload) => {
    try {
      if (!rateLimitStore.check(socket.id, 'webrtc')) return;
      if (!payload || typeof payload !== 'object') return;
      
      const { targetSocketId, sdp } = payload;
      if (typeof targetSocketId !== 'string') return;
      if (!sdp || typeof sdp !== 'object') return;
      if (JSON.stringify(sdp).length > LIMITS.SDP) return;

      if (!validateWebrtcAuth(targetSocketId)) return;

      io.to(targetSocketId).emit('webrtc-offer', {
          sdp,
          callerSocketId: socket.id
      });
    } catch (e) {}
  });

  socket.on('webrtc-answer', (payload) => {
    try {
      if (!rateLimitStore.check(socket.id, 'webrtc')) return;
      if (!payload || typeof payload !== 'object') return;
      
      const { targetSocketId, sdp } = payload;
      if (typeof targetSocketId !== 'string') return;
      if (!sdp || typeof sdp !== 'object') return;
      if (JSON.stringify(sdp).length > LIMITS.SDP) return;

      if (!validateWebrtcAuth(targetSocketId)) return;

      io.to(targetSocketId).emit('webrtc-answer', {
          sdp,
          answererSocketId: socket.id
      });
    } catch (e) {}
  });

  socket.on('webrtc-ice-candidate', (payload) => {
    try {
      if (!rateLimitStore.check(socket.id, 'webrtc')) return;
      if (!payload || typeof payload !== 'object') return;
      
      const { targetSocketId, candidate } = payload;
      if (typeof targetSocketId !== 'string') return;
      if (!candidate || typeof candidate !== 'object') return;
      if (JSON.stringify(candidate).length > LIMITS.SDP) return;

      if (!validateWebrtcAuth(targetSocketId)) return;

      io.to(targetSocketId).emit('webrtc-ice-candidate', {
          candidate,
          senderSocketId: socket.id
      });
    } catch (e) {}
  });

  socket.on('leave-room', () => {
    try {
      if (currentRoom) {
        const prevRoom = currentRoom;
        roomStore.removeUser(currentRoom, socket.id);
        socket.to(currentRoom).emit('left', currentUser);
        io.to(currentRoom).emit('room-users', roomStore.getUsersArray(currentRoom));
        socket.leave(currentRoom);
        currentRoom = null;
        currentUser = null;
        destroyRoomIfEmpty(prevRoom);
      }
    } catch (e) {}
  });

  socket.on('disconnect', () => {
    try {
      if (currentRoom) {
        const prevRoom = currentRoom;
        roomStore.removeUser(currentRoom, socket.id);
        socket.to(currentRoom).emit('left', currentUser);
        io.to(currentRoom).emit('room-users', roomStore.getUsersArray(currentRoom));
        destroyRoomIfEmpty(prevRoom);
      }
      rateLimitStore.cleanup(socket.id);
    } catch (e) {}
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`[Server] Chat backend running on port ${PORT}`);
});
