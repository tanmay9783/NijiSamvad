import { spawn } from 'child_process';

const PORT = 5010;
const SERVER_URL = `http://localhost:${PORT}`;
let serverProcess;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
    console.log('Starting production server...');
    return new Promise((resolve) => {
        serverProcess = spawn('node', ['server/server.js'], {
            env: { ...process.env, PORT, NODE_ENV: 'production' }
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

async function runTests() {
    try {
        await startServer();
        await sleep(1000); // Give express a moment to bind routes

        // 1. Test /health
        console.log('Testing GET /health');
        const healthRes = await fetch(`${SERVER_URL}/health`);
        if (!healthRes.ok) throw new Error(`/health returned ${healthRes.status}`);
        const healthData = await healthRes.json();
        if (healthData.status !== 'alive') throw new Error('Health status not alive');
        console.log('✅ GET /health passed');

        // 2. Test CSP presence
        console.log('Testing CSP Headers');
        const statsRes = await fetch(`${SERVER_URL}/api/stats`);
        const csp = statsRes.headers.get('content-security-policy');
        if (!csp || !csp.includes("default-src 'none'")) {
            throw new Error('Production CSP not enforced!');
        }
        console.log('✅ Production CSP passed');

        // 3. Test Graceful Shutdown (SIGTERM)
        console.log('Testing Graceful Shutdown (SIGTERM)');
        serverProcess.kill('SIGTERM');
        
        await new Promise(resolve => {
            serverProcess.on('close', (code) => {
                if (code !== 0) throw new Error(`Server exited with code ${code}`);
                resolve();
            });
        });
        console.log('✅ Server cleanly shut down with code 0.');
        
        console.log('\n🎉 All Production Smoke Tests Passed!');
        process.exit(0);

    } catch (e) {
        console.error('❌ Test Failed:', e);
        if (serverProcess) serverProcess.kill('SIGKILL');
        process.exit(1);
    }
}

runTests();
