import { io } from 'socket.io-client';
import { spawn } from 'child_process';
import { generateSecureRoomSecret, deriveKeys, encryptMessage, decryptMessage } from '../src/services/crypto.js';

const PORT = 5007; // Unique port for 6-user simulation test

async function run6UserSimulation() {
  console.log('🚀 Starting 6-User Full Feature Simulation & Bug Search...');

  // 1. Generate E2EE Room Secret & Derive Keys
  const roomSecret = generateSecureRoomSecret();
  const roomName = 'multiuser-test-room';
  const { encryptionKey, authHash } = await deriveKeys(roomSecret, roomName);

  console.log(`🔑 Room Secret generated: ${roomSecret} (derived authHash: ${authHash.substring(0, 8)}...)`);

  // 2. Spawn Backend Server
  const serverProcess = spawn('node', ['server/server.js'], {
    env: { ...process.env, PORT },
    stdio: 'pipe'
  });

  await new Promise(resolve => setTimeout(resolve, 1500));

  const createClient = () => {
    return io(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true
    });
  };

  const userNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank'];
  const sockets = [];

  try {
    // 3. Connect 6 Sockets to Server
    console.log('⚡ Connecting 6 user sockets...');
    for (let i = 0; i < 6; i++) {
      const socket = createClient();
      await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', (err) => reject(new Error(`Socket ${i} connection error: ${err.message}`)));
      });
      sockets.push(socket);
    }
    console.log('✅ 6 Sockets connected to Socket.IO backend.');

    // 4. Join Room for All 6 Users
    console.log('👥 Joining room for 6 users with PBKDF2 authHash...');
    const userListPromise = new Promise((resolve) => {
      let finalUsers = [];
      sockets[0].on('room-users', (users) => {
        finalUsers = users;
        if (users.length === 6) resolve(users);
      });
    });

    for (let i = 0; i < 6; i++) {
      const socket = sockets[i];
      const userName = userNames[i];
      socket.emit('new-user-joined', { userName, roomName, authHash });
      await new Promise((resolve, reject) => {
        socket.once('join-success', resolve);
        socket.once('join-error', (err) => reject(new Error(`User ${userName} join failed: ${err}`)));
      });
    }

    const roomUsers = await userListPromise;
    if (roomUsers.length !== 6) {
      throw new Error(`Expected 6 room users, got ${roomUsers.length}`);
    }
    console.log(`✅ Room successfully joined by 6 users: ${roomUsers.map(u => u.username).join(', ')}`);

    // 5. Test Encrypted Messaging Broadcast Across 6 Users
    console.log('🔒 Testing E2EE Encrypted Messaging across 6 users...');
    const testMessageText = 'Hello from User 1 (Alice) to all 6 participants!';
    const encryptedPayload = await encryptMessage(testMessageText, encryptionKey);

    const receivedCountPromise = new Promise((resolve, reject) => {
      let received = 0;
      const timeout = setTimeout(() => reject(new Error(`Encrypted message broadcast timed out (received ${received}/5)`)), 5000);

      // Listen on users 2 to 6
      for (let i = 1; i < 6; i++) {
        sockets[i].once('receive', async (msg) => {
          try {
            const parsed = JSON.parse(msg.message);
            const decrypted = await decryptMessage(parsed, encryptionKey);
            if (decrypted === testMessageText && msg.name === 'Alice') {
              received++;
              if (received === 5) {
                clearTimeout(timeout);
                resolve();
              }
            }
          } catch (err) {
            reject(new Error(`User ${userNames[i]} failed to decrypt message: ${err.message}`));
          }
        });
      }
    });

    // Alice sends the protocol JSON envelope
    sockets[0].emit('send', { content: JSON.stringify(encryptedPayload) });
    await receivedCountPromise;
    console.log('✅ All 5 other users received and successfully decrypted Alice’s E2EE message!');

    // 6. Test Encrypted Attachment Upload & Download
    console.log('📁 Testing Encrypted Attachment Upload & Multi-User Download...');
    const rawFileBuffer = Buffer.from('Confidential report shared among 6 participants');
    const uploadRes = await fetch(`http://localhost:${PORT}/api/attachments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-room-name': roomName,
        'x-auth-hash': authHash
      },
      body: rawFileBuffer
    });

    if (!uploadRes.ok) {
      throw new Error(`Attachment upload failed with status ${uploadRes.status}`);
    }

    const { id: attachmentId } = await uploadRes.json();
    console.log(`  Attachment uploaded with ID: ${attachmentId}`);

    // Verify all 6 users can fetch the attachment
    for (let i = 0; i < 6; i++) {
      const fetchRes = await fetch(`http://localhost:${PORT}/api/attachments/${attachmentId}`, {
        headers: {
          'x-room-name': roomName,
          'x-auth-hash': authHash
        }
      });
      if (!fetchRes.ok) {
        throw new Error(`User ${userNames[i]} failed to download attachment (status ${fetchRes.status})`);
      }
      const fetchedBuffer = Buffer.from(await fetchRes.arrayBuffer());
      if (!fetchedBuffer.equals(rawFileBuffer)) {
        throw new Error(`User ${userNames[i]} downloaded corrupted attachment content`);
      }
    }
    console.log('✅ All 6 users successfully fetched and verified attachment content!');

    // 7. Test WebRTC Call Invitation Flow Across 6 Users
    console.log('📞 Testing WebRTC Call Invitation signaling across 6 users...');
    const invitePromises = [];
    for (let i = 1; i < 6; i++) {
      invitePromises.push(new Promise((resolve) => {
        sockets[i].once('call-invite', (data) => resolve(data));
      }));
    }

    // Alice (User 1) emits call-invite
    sockets[0].emit('call-invite');
    const inviteDataList = await Promise.all(invitePromises);
    if (inviteDataList.some(data => data.callerName !== 'Alice')) {
      throw new Error('Caller name mismatch in call-invite payload');
    }
    console.log('✅ Call invitation received by all 5 room peers!');

    // Users 2, 3, 4, 5 accept call invitation; User 6 declines call invitation
    const acceptPromise = new Promise((resolve) => {
      let acceptCount = 0;
      sockets[0].on('call-accept', (data) => {
        acceptCount++;
        if (acceptCount === 4) resolve();
      });
    });

    const declinePromise = new Promise((resolve) => {
      sockets[0].once('call-decline', (data) => {
        if (data.declinerName === 'Frank') resolve();
      });
    });

    for (let i = 1; i < 5; i++) {
      sockets[i].emit('call-accept', { targetSocketId: sockets[0].id });
    }
    sockets[5].emit('call-decline', { targetSocketId: sockets[0].id });

    await Promise.all([acceptPromise, declinePromise]);
    console.log('✅ Call invitations accepted by 4 peers and declined by 1 peer cleanly!');

    // 8. Test 6-User WebRTC P2P Mesh Offer/Answer Signaling Exchange
    console.log('🌐 Testing 6-User WebRTC Signaling Mesh (30 Peer Connection Pairs)...');
    let signalingCount = 0;

    // Set up offer listeners on all sockets
    const offerPromises = sockets.map((socket, index) => {
      return new Promise((resolve) => {
        let receivedOffers = 0;
        socket.on('webrtc-offer', ({ callerSocketId, sdp }) => {
          receivedOffers++;
          signalingCount++;
          // Respond with answer
          socket.emit('webrtc-answer', { targetSocketId: callerSocketId, sdp: { type: 'answer', sdp: `dummy-answer-from-${index}` } });
          if (receivedOffers === 5) resolve();
        });
      });
    });

    // Every socket emits offer to every other socket
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        if (i !== j) {
          sockets[i].emit('webrtc-offer', {
            targetSocketId: sockets[j].id,
            sdp: { type: 'offer', sdp: `dummy-offer-from-${i}-to-${j}` }
          });
        }
      }
    }

    await Promise.all(offerPromises);
    console.log(`✅ WebRTC Signaling Mesh successfully exchanged ${signalingCount} P2P offer/answer signals across 6 users!`);

    // 8.5 Test Rate Limiting & Cross-Room Abuse
    console.log('🛡️ Testing Security: Rate Limiting & Cross-Room Isolation...');
    const evilSocket = createClient();
    await new Promise((resolve) => evilSocket.on('connect', resolve));
    evilSocket.emit('new-user-joined', { userName: 'Evil', roomName: 'evil-room', authHash: '' });
    await new Promise((resolve) => { evilSocket.once('join-success', resolve); });
    
    // Cross-room abuse: Evil tries to send offer to Alice
    let aliceReceivedEvilOffer = false;
    sockets[0].once('webrtc-offer', () => { aliceReceivedEvilOffer = true; });
    
    evilSocket.emit('webrtc-offer', { targetSocketId: sockets[0].id, sdp: { type: 'offer', sdp: 'evil' } });
    await new Promise(r => setTimeout(r, 500)); // wait to see if it arrives
    if (aliceReceivedEvilOffer) throw new Error('Security Breach: Alice received cross-room WebRTC offer!');
    console.log('✅ Cross-room signaling correctly rejected!');

    // Rate Limiting Abuse (webrtc limit is 50 per 5s, penalty at 150)
    let evilDisconnected = false;
    evilSocket.on('disconnect', () => { evilDisconnected = true; });
    
    // Spam the server
    for (let k = 0; k < 200; k++) {
      evilSocket.emit('webrtc-offer', { targetSocketId: evilSocket.id, sdp: { type: 'offer', sdp: 'spam' } });
    }
    await new Promise(r => setTimeout(r, 500));
    
    if (!evilDisconnected) {
      throw new Error('Security Breach: Evil socket was not disconnected after rate limit abuse!');
    }
    console.log('✅ Rate Limit strictly enforced: Spammer socket forcibly disconnected!');

    // 9. Test Disconnect & Room Cleanup

    console.log('🧹 Testing Disconnect & Room Destruction...');
    for (let i = 0; i < 5; i++) {
      sockets[i].disconnect();
    }
    await new Promise(r => setTimeout(r, 400));

    // Attachment should still exist while User 6 is connected
    const fetchStill = await fetch(`http://localhost:${PORT}/api/attachments/${attachmentId}`, {
      headers: { 'x-room-name': roomName, 'x-auth-hash': authHash }
    });
    if (!fetchStill.ok) throw new Error('Attachment should still exist while User 6 is connected');

    // Last user leaves
    sockets[5].disconnect();
    await new Promise(r => setTimeout(r, 600));

    // Attachment should be deleted now
    const fetchDestroyed = await fetch(`http://localhost:${PORT}/api/attachments/${attachmentId}`, {
      headers: { 'x-room-name': roomName, 'x-auth-hash': authHash }
    });
    if (fetchDestroyed.ok) throw new Error('Attachment should have been deleted when the last user left');
    console.log('✅ Room & attachments destroyed cleanly when last user left!');

    console.log('\n🎉 ALL 6-USER SIMULATION TESTS PASSED WITH 0 BUGS DETECTED!');
  } finally {
    sockets.forEach(s => s.disconnected || s.disconnect());
    serverProcess.kill();
  }
}

run6UserSimulation().catch((err) => {
  console.error(`\n❌ SIMULATION TEST FAILED: ${err.message}`);
  process.exit(1);
});
