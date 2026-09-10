import { io } from 'socket.io-client';
import { spawn } from 'child_process';

const PORT = 5006; // Different port to avoid conflicts

async function runServerTests() {
  console.log('Starting Server Security Tests...');

  const serverProcess = spawn('node', ['server/server.js'], {
    env: { ...process.env, PORT },
    stdio: 'pipe'
  });

  await new Promise(resolve => setTimeout(resolve, 1500));

  let testsPassed = 0;
  let testsFailed = 0;

  const runTest = async (name, testFn) => {
    try {
      await testFn();
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (e) {
      console.error(`❌ ${name}: ${e.message}`);
      testsFailed++;
    }
  };

  const createClient = () => {
    return io(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true
    });
  };

  const joinRoom = (client, userName, roomName) => {
    return new Promise((resolve) => {
      client.emit('new-user-joined', { userName, roomName, authHash: 'testhash' });
      client.once('join-success', () => resolve());
    });
  };

  // Phase 2 Base Tests
  await runTest('Correct authHash allows joining', () => {
    return new Promise((resolve, reject) => {
      const socket = createClient();
      socket.on('connect', () => {
        socket.emit('new-user-joined', { userName: 'Alice', roomName: 'room1', authHash: 'testhash' });
      });
      socket.on('join-success', () => { socket.disconnect(); resolve(); });
      socket.on('join-error', (err) => { socket.disconnect(); reject(new Error(err)); });
    });
  });

  // Phase 3 Tests

  await runTest('Message Security - valid message succeeds', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    await joinRoom(s1, 'Alice', 'msg-room');
    await joinRoom(s2, 'Bob', 'msg-room');

    return new Promise((resolve, reject) => {
      s2.once('receive', (payload) => {
        if (payload.name !== 'Alice') reject(new Error('Sender identity spoofed'));
        if (payload.message !== 'hello') reject(new Error('Content mismatch'));
        if (!payload.id) reject(new Error('Missing server generated ID'));
        s1.disconnect(); s2.disconnect();
        resolve();
      });
      s1.emit('send', { content: 'hello' });
    });
  });

  await runTest('Message Security - oversized message rejected', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    await joinRoom(s1, 'Alice', 'msg-room-size');
    await joinRoom(s2, 'Bob', 'msg-room-size');

    return new Promise((resolve, reject) => {
      s2.once('receive', () => {
        reject(new Error('Oversized message was broadcasted'));
      });
      const hugeString = 'a'.repeat(300 * 1024); // 300KB, > 256KB limit
      s1.emit('send', { content: hugeString });
      setTimeout(() => { s1.disconnect(); s2.disconnect(); resolve(); }, 500);
    });
  });

  await runTest('Message Security - unauthenticated socket cannot send', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    await joinRoom(s2, 'Bob', 'msg-room-unauth');

    return new Promise((resolve, reject) => {
      s2.once('receive', () => {
        reject(new Error('Received message from unauthenticated socket'));
      });
      s1.emit('send', { content: 'hello' });
      setTimeout(() => { s1.disconnect(); s2.disconnect(); resolve(); }, 500);
    });
  });

  await runTest('Reaction - arbitrary metadata is not forwarded', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    await joinRoom(s1, 'Alice', 'react-room');
    await joinRoom(s2, 'Bob', 'react-room');

    return new Promise((resolve, reject) => {
      s2.once('reaction-added', (payload) => {
        if (payload.hacked) reject(new Error('Arbitrary metadata was forwarded'));
        s1.disconnect(); s2.disconnect();
        resolve();
      });
      s1.emit('message-reaction', { messageId: 'msg1', emoji: '👍', hacked: true });
    });
  });

  await runTest('WebRTC - valid same-room signaling succeeds', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    await joinRoom(s1, 'Alice', 'webrtc-room');
    await joinRoom(s2, 'Bob', 'webrtc-room');

    return new Promise((resolve, reject) => {
      s2.once('webrtc-offer', (payload) => {
        if (payload.callerSocketId !== s1.id) reject(new Error('Wrong caller id'));
        s1.disconnect(); s2.disconnect();
        resolve();
      });
      s1.emit('webrtc-offer', { targetSocketId: s2.id, sdp: { type: 'offer', sdp: 'xyz' } });
    });
  });

  await runTest('WebRTC - cross-room target rejected', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    await joinRoom(s1, 'Alice', 'webrtc-room-A');
    await joinRoom(s2, 'Bob', 'webrtc-room-B');

    return new Promise((resolve, reject) => {
      s2.once('webrtc-offer', () => {
        reject(new Error('Cross-room signaling allowed!'));
      });
      s1.emit('webrtc-offer', { targetSocketId: s2.id, sdp: { type: 'offer', sdp: 'xyz' } });
      setTimeout(() => { s1.disconnect(); s2.disconnect(); resolve(); }, 500);
    });
  });

  await runTest('Room isolation - users in A cannot receive B events', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    await joinRoom(s1, 'Alice', 'iso-room-A');
    await joinRoom(s2, 'Bob', 'iso-room-B');

    return new Promise((resolve, reject) => {
      s2.once('receive', () => reject(new Error('Received cross-room message')));
      s2.once('user-typing', () => reject(new Error('Received cross-room typing')));
      s2.once('chat-cleared', () => reject(new Error('Received cross-room clear')));
      
      s1.emit('send', { content: 'hello' });
      s1.emit('typing', true);
      s1.emit('clear-chat');
      
      setTimeout(() => { s1.disconnect(); s2.disconnect(); resolve(); }, 500);
    });
  });

  await runTest('Rate limiting - throttles excessive typing', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    await joinRoom(s1, 'Alice', 'rate-room');
    await joinRoom(s2, 'Bob', 'rate-room');

    return new Promise((resolve, reject) => {
      let typingCount = 0;
      s2.on('user-typing', () => { typingCount++; });
      
      for(let i=0; i<20; i++) {
        s1.emit('typing', true);
      }
      
      setTimeout(() => { 
        s1.disconnect(); s2.disconnect(); 
        if (typingCount <= 5 && typingCount > 0) {
            resolve();
        } else {
            reject(new Error(`Throttling failed, received ${typingCount} typing events`));
        }
      }, 500);
    });
  });

  // Setup a room first to upload attachments
  await runTest('Room Lifecycle - Last User Leaves Destroys Data', async () => {
    const s1 = createClient();
    const s2 = createClient();
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));
    
    await joinRoom(s1, 'Alice', 'destroy-room');
    await joinRoom(s2, 'Bob', 'destroy-room');

    // 1. Upload attachment
    const res = await fetch(`http://localhost:${PORT}/api/attachments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/octet-stream',
        'x-room-name': 'destroy-room',
        'x-auth-hash': 'testhash'
      },
      body: new Uint8Array([1, 2, 3])
    });
    if (!res.ok) throw new Error('Valid upload failed');
    const { id } = await res.json();
    if (!id || typeof id !== 'string') throw new Error('Did not return string ID');
    
    // 2. Fetch works
    const getRes = await fetch(`http://localhost:${PORT}/api/attachments/${id}`, {
      headers: {
        'x-room-name': 'destroy-room',
        'x-auth-hash': 'testhash'
      }
    });
    if (!getRes.ok) throw new Error('Could not fetch uploaded attachment');
    
    // 3. Unauthenticated fetch fails
    const noAuthRes = await fetch(`http://localhost:${PORT}/api/attachments/${id}`);
    if (noAuthRes.ok) throw new Error('Unauthenticated fetch should have failed');
    
    // 4. Cross-room fetch fails
    const crossRes = await fetch(`http://localhost:${PORT}/api/attachments/${id}`, {
      headers: { 'x-room-name': 'another-room', 'x-auth-hash': 'testhash' }
    });
    if (crossRes.ok) throw new Error('Cross-room fetch should have failed');
    
    // 5. First user leaves (room remains)
    s1.disconnect();
    await new Promise(resolve => setTimeout(resolve, 300));
    const getResStill = await fetch(`http://localhost:${PORT}/api/attachments/${id}`, {
      headers: { 'x-room-name': 'destroy-room', 'x-auth-hash': 'testhash' }
    });
    if (!getResStill.ok) throw new Error('Attachment should still exist');
    
    // 6. Last user leaves (room destroyed)
    s2.disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 7. Fetch after destroy fails (401 or 404)
    const getResDestroyed = await fetch(`http://localhost:${PORT}/api/attachments/${id}`, {
      headers: { 'x-room-name': 'destroy-room', 'x-auth-hash': 'testhash' }
    });
    if (getResDestroyed.ok) throw new Error('Attachment should have been deleted');
  });

  await runTest('Attachment Upload - Oversized Rejected', async () => {
    // We must create a room for this first
    const s1 = createClient();
    await new Promise(r => s1.on('connect', r));
    await joinRoom(s1, 'Alice', 'upload-limit');

    const hugeBody = new Uint8Array(11 * 1024 * 1024); // 11MB
    const res = await fetch(`http://localhost:${PORT}/api/attachments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/octet-stream',
        'x-room-name': 'upload-limit',
        'x-auth-hash': 'testhash'
      },
      body: hugeBody
    });
    if (res.ok) throw new Error('Oversized body was accepted');
    s1.disconnect();
  });

  await runTest('Attachment Fetch - Unknown 404', async () => {
    const s1 = createClient();
    await new Promise(r => s1.on('connect', r));
    await joinRoom(s1, 'Alice', 'unknown-room');

    const res = await fetch(`http://localhost:${PORT}/api/attachments/550e8400-e29b-41d4-a716-446655440000`, {
      headers: { 'x-room-name': 'unknown-room', 'x-auth-hash': 'testhash' }
    });
    if (res.ok) throw new Error('Unknown id returned ok');
    s1.disconnect();
  });

  await runTest('Attachment Fetch - Traversal Blocked', async () => {
    const s1 = createClient();
    await new Promise(r => s1.on('connect', r));
    await joinRoom(s1, 'Alice', 'trav-room');

    const res = await fetch(`http://localhost:${PORT}/api/attachments/..%2f..%2fpackage.json`, {
      headers: { 'x-room-name': 'trav-room', 'x-auth-hash': 'testhash' }
    });
    if (res.ok) throw new Error('Path traversal returned ok');
    s1.disconnect();
  });

  serverProcess.kill();

  console.log(`\nTests completed: ${testsPassed} passed, ${testsFailed} failed.`);
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runServerTests();
