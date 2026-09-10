# SecureChat

A portfolio-grade, full-stack real-time communication application engineered with End-to-End Encryption (E2EE), secure room isolation, and a modern glassmorphic interface.

## 🚀 Features

- **End-to-End Encryption (E2EE)**: Messages are encrypted client-side using AES-256-CBC with PBKDF2 key derivation. The server never sees the plaintext messages.
- **Cryptographic Fingerprinting**: Rooms generate a visual safety hash (similar to Signal/WhatsApp) to verify key alignment among participants.
- **Robust Real-Time Architecture**: Built with Node.js, Express, and Socket.io. SecureChat does not intentionally persist room content. Application-controlled room state and temporary encrypted attachments are strictly deleted when the room becomes empty.
- **Rich Chat Capabilities**:
  - Active user presence and member rosters.
  - Live typing indicators with debouncing.
  - Emoji picker integration and rich message formatting.
  - Encrypted image and file attachments.
  - Zero-dependency Web Audio API notification synthesized chimes.
- **WebRTC Voice & Video Calls**: Peer-to-peer (Mesh) multimedia streaming directly within the room, secured natively via DTLS-SRTP.
- **Interactive Demo Mode**: Instantly test all UI capabilities offline via a built-in simulation engine.
- **Security First**: 100% immune to XSS injection through safe React rendering.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Tailwind-inspired Vanilla CSS (Glassmorphism), Lucide React (Icons).
- **Backend**: Node.js, Express, Socket.io.
- **Security**: CryptoJS (AES-256), XSS-safe component rendering.

## 📦 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/securechat.git
   cd securechat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the Full-Stack Application Locally**
   ```bash
   npm run dev:full
   ```
   *This concurrently starts the Express/Socket.io backend on port 5000 and the Vite frontend on port 5173.*

## 🔒 Security Architecture

1. **Separation of Authentication and Encryption**: The user's room password never leaves the client. Instead, the Web Crypto API derives two distinct credentials using PBKDF2:
   - **`encryptionKey`**: Used for AES-GCM message encryption. This key never leaves the client and the server never sees it.
   - **`authHash`**: Sent to the server for room authentication. Treated as sensitive credential material by the server and never broadcast to other users.
2. **Server as a Secure Relay**: The Node.js server validates room membership using the `authHash`, but strictly routes ciphertext. The server has zero knowledge of the message plaintext.
3. **Encrypted Attachment Architecture**: Large files are no longer sent via Socket.IO. Instead:
   - A unique AES-256-GCM key and IV is generated per file.
   - The file is encrypted locally and the opaque binary is uploaded to an `attachmentStore`.
   - The unique file encryption key is then sent *inside* the standard room E2EE metadata. The server and storage provider never see the file contents or the decryption key.
4. **Cryptographic Fingerprinting**: Rooms generate a visual safety hash to verify key alignment among participants, preventing MITM attacks.
5. **XSS Prevention**: User inputs are strictly handled via React state without `dangerouslySetInnerHTML`.

## 👨‍💻 Author

**Tanmay**  
*Software Engineer*

*Developed as a showcase of secure real-time system architecture and modern frontend engineering.*

## Phase 6 - Security, Functional & Failure Testing
The architecture has been rigorously tested against edge cases, including:
- **Ephemeral Room Lifecycle**: Application-controlled room state and encrypted attachment files are strictly deleted when the final participant leaves.
- **Race conditions**: Simultaneous disconnects and abrupt socket terminations safely clean up memory and disk space without crashing.
- **No Persistent Chat Database**: Why Redis/database/object storage are intentionally not required? This architecture enforces absolute privacy by ensuring chat history cannot be compromised via server logs or DB leaks; the data only exists in memory while the room is active.
- **Production CSP**: For production hardening, a Content Security Policy should allow `'self'`, `'unsafe-inline'` (for React), `ws:` / `wss:` (for WebSockets), and `blob:` / `data:` for object URLs and WebRTC streams. Ensure WSS/HTTPS is used in production.

> **Note**: Application-controlled data deletion does not make claims about provider/network/server infrastructure logs, backups, or OS-level storage outside the application's direct control.

## Phase 7 - WebRTC Reliability & Call Lifecycle Hardening
- **Mesh Architecture**: The application employs a WebRTC mesh architecture optimized for small ephemeral rooms. There is no Media Server or SFU to manage scaling. 
- **Zero-Cost Strategy**: The project explicitly avoids infrastructure dependencies like TURN servers or persistent databases. Direct Peer-to-Peer (P2P) connections are established via STUN. If strict corporate firewalls block direct P2P connections, WebRTC may fail gracefully to a "receive-only" or isolated state without crashing the app.
- **Race Condition Immunity**: An audited signaling lifecycle ensures that late joiners, colliding connection attempts, and ungraceful disconnects maintain application stability with strict `RTCPeerConnection` cleanup.

## Phase 8 - Production Security Hardening
- **Transport Security (HTTPS/WSS)**: Production deployments MUST use HTTPS and WSS. Because Socket.IO passes the `authHash` in headers and payloads, plaintext HTTP exposes room credentials to interception.
- **Content Security Policy (CSP)**: Helmet is configured with a strict CSP. In production, inline scripts and eval are disabled, allowing only local origins for API and WebRTC/Blob streams.
- **CORS Isolation**: Access is restricted strictly to the configured `CLIENT_ORIGIN` environment variable.
- **No Persistent Storage Guarantee**: The application guarantees that all in-memory room state and temporary encrypted attachment files are deleted when the final participant leaves. However, this does NOT make guarantees about external infrastructure (e.g. reverse proxy logs, OS-level filesystem caches, hosting provider backups).

## Phase 11 - Professional Call & Video Experience
- **Explicit Call Permission**: Incoming WebRTC calls must be explicitly accepted via `[ Accept ]` or declined via `[ Decline ]`. No WebRTC SDP offers are created or sent to recipients until they accept.
- **Group Call Invitations**: Room calls selectively connect only participants who accept. Late joiners see an active `"Join Call"` banner without being forced into an ongoing call.
- **Peer-to-Peer Screen Sharing**: Users can share their screen in real-time via `getDisplayMedia()`, using `RTCRtpSender.replaceTrack()` without disrupting active microphone audio or requiring media servers.
- **Meeting / Video Mode**: Dedicated video call UI with responsive participant grids, featured video tile selection, chat toggle, and native Fullscreen API integration.
- **Recommended Call Scale**: Optimized for mesh peer-to-peer calls up to **6 participants** (experimental up to 8).
- **Audio Note**: Music/audio-file sharing is intentionally not implemented in this phase.

