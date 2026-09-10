import { spawn } from 'child_process';
import { io } from 'socket.io-client';
import fs from 'fs';

const PORT = 5009;
const SERVER_URL = `http://localhost:${PORT}`;
let serverProcess;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getMetrics() {
    try {
        const res = await fetch(`${SERVER_URL}/debug/metrics`);
        return await res.json();
    } catch {
        return null;
    }
}

async function startServer() {
    console.log('Starting server...');
    return new Promise((resolve) => {
        serverProcess = spawn('node', ['server/server.js'], {
            env: { ...process.env, PORT, ENABLE_LOAD_METRICS: '1' }
        });
        
        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes('running on port')) {
                resolve();
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            console.error('Server error:', data.toString());
        });
    });
}

function createClient(username, roomname) {
    return new Promise((resolve, reject) => {
        const socket = io(SERVER_URL, {
            transports: ['websocket'],
            reconnection: false
        });
        
        socket.on('connect', () => {
            socket.emit('new-user-joined', { userName: username, roomName: roomname, authHash: null });
        });
        
        socket.on('join-success', () => {
            resolve(socket);
        });
        
        socket.on('connect_error', reject);
    });
}

async function testConnectionLoad(numUsers) {
    console.log(`\n--- Connection Load Test: ${numUsers} Users ---`);
    const startTime = Date.now();
    const sockets = [];
    
    // Connect users
    for (let i = 0; i < numUsers; i++) {
        const socket = await createClient(`user_${i}`, 'LoadRoom');
        sockets.push(socket);
    }
    const connectTime = Date.now() - startTime;
    console.log(`Connected ${numUsers} users in ${connectTime}ms`);
    
    const metrics = await getMetrics();
    console.log(`Memory RSS: ${Math.round(metrics.memory.rss / 1024 / 1024)} MB, Rooms: ${metrics.rooms}, Users: ${metrics.users}`);
    
    return sockets;
}

async function testMessageThroughput(sockets, messagesPerUser) {
    console.log(`\n--- Message Throughput Test: ${messagesPerUser} msgs/user ---`);
    const totalExpected = sockets.length * messagesPerUser * (sockets.length - 1); // Fan-out
    let received = 0;
    
    sockets.forEach(s => {
        s.on('receive', () => {
            received++;
        });
    });
    
    const startTime = Date.now();
    let sent = 0;
    for (let i = 0; i < messagesPerUser; i++) {
        for (const s of sockets) {
            s.emit('send', { id: `msg_${Date.now()}`, content: 'A'.repeat(1024) }); // 1KB message
            sent++;
        }
        await sleep(10); // slight yield to avoid choking local network buffer
    }
    
    // Wait for delivery
    await sleep(2000);
    const duration = Date.now() - startTime;
    
    console.log(`Sent ${sent} messages. Total Received (Fan-out): ${received} / ${totalExpected}`);
    console.log(`Duration: ${duration}ms. Rate: ${Math.round((sent / duration) * 1000)} msgs/sec`);
    
    sockets.forEach(s => s.off('receive'));
}

async function testAttachments(numAttachments, sizeMB) {
    console.log(`\n--- Attachment Load Test: ${numAttachments} x ${sizeMB}MB ---`);
    const buffer = Buffer.alloc(sizeMB * 1024 * 1024, 'B'); // filled buffer
    const startTime = Date.now();
    
    const promises = [];
    for (let i = 0; i < numAttachments; i++) {
        promises.push(
            fetch(`${SERVER_URL}/api/attachments`, {
                method: 'POST',
                headers: { 'x-room-name': 'UploadRoom', 'x-auth-hash': '', 'Content-Type': 'application/octet-stream' },
                body: buffer
            }).then(r => r.json())
        );
    }
    
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    console.log(`Uploaded ${numAttachments} files in ${duration}ms. Throughput: ${Math.round((numAttachments * sizeMB) / (duration / 1000))} MB/s`);
    return results.map(r => r.id);
}

async function verifyCleanup() {
    console.log('\n--- Verifying Cleanup ---');
    let metrics = await getMetrics();
    console.log(`Pre-cleanup Memory RSS: ${Math.round(metrics.memory.rss / 1024 / 1024)} MB, Rooms: ${metrics.rooms}`);
    
    const dir = fs.readdirSync('uploads');
    console.log(`Uploads folder contains ${dir.length} files.`);
    
    if (metrics.rooms > 0 || dir.length > 0) {
        console.error('❌ LEAK DETECTED!');
    } else {
        console.log('✅ Cleanup successful.');
    }
}

async function run() {
    try {
        await startServer();
        
        let initialMetrics = await getMetrics();
        console.log(`Baseline Memory RSS: ${Math.round(initialMetrics.memory.rss / 1024 / 1024)} MB`);

        // Test Phase 1: Small Load
        const sockets10 = await testConnectionLoad(10);
        await testMessageThroughput(sockets10, 5);
        sockets10.forEach(s => s.disconnect());
        await sleep(1000); // allow disconnect to process

        // Test Phase 2: Medium Load
        const sockets50 = await testConnectionLoad(50);
        await testMessageThroughput(sockets50, 2);
        
        // During Phase 2, upload some attachments
        // Create an uploader socket just to keep a room alive for attachments
        const uploadSocket = await createClient('Uploader', 'UploadRoom');
        const ids = await testAttachments(10, 1); // 10 uploads of 1MB
        
        sockets50.forEach(s => s.disconnect());
        uploadSocket.disconnect();
        await sleep(1000); // allow disconnect to process
        
        await verifyCleanup();
        
    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        if (serverProcess) serverProcess.kill();
        process.exit(0);
    }
}

run();
