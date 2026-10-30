# PROJECT CAREER ASSETS: NijiSamvad (निजी संवाद)

> **Verified Career Assets, Resume Bullet Points, Portfolio Entries, LinkedIn Content & Technical Interview Guide**  
> *Target Audience: Technical Recruiters, Engineering Managers, and Technical Interviewers*

---

## 1. Portfolio Descriptions

### One-Line Project Description
A zero-knowledge, zero-database real-time communication platform engineered with React 19, Node.js, WebCrypto, and WebRTC, delivering end-to-end encrypted messaging, binary attachments, and peer-to-peer multimedia calling with strict ephemeral teardown.

### Short Description (30–50 words)
NijiSamvad is an end-to-end encrypted, zero-database real-time communication platform. Built with React 19, Node.js, and Web Crypto APIs, it provides AES-256-GCM encrypted messaging, secure binary file sharing, and direct peer-to-peer WebRTC video calling—ensuring complete confidentiality with zero persistent server-side data retention.

### Medium Description (80–120 words)
NijiSamvad is an enterprise-grade, zero-knowledge communication platform engineered for complete conversational privacy. Built from first principles using React 19, Node.js, Socket.IO, and native WebCrypto APIs, it eliminates persistent storage vulnerabilities by operating entirely in memory without a database. Symmetric AES-256-GCM encryption keys are derived client-side via PBKDF2-SHA-256 (100,000 iterations), ensuring the server operates as an unprivileged message relay with zero plaintext visibility. The platform supports encrypted binary file attachments, contextual threaded replies, visual cryptographic safety fingerprints, and high-definition multi-party WebRTC video calling with live active speaker detection and dynamic screen sharing.

### Detailed Description (150–200 words)
NijiSamvad (Hindi: *निजी संवाद*, "Private Dialogue") is a production-grade, zero-database real-time messaging and multimedia calling system engineered to guarantee absolute data ephemerality. Unlike centralized messaging platforms that retain metadata and transcripts on cloud infrastructure, NijiSamvad implements a zero-trust cryptographic model: users independently derive symmetric AES-256-GCM keys on client devices using PBKDF2 with 100,000 iterations. Cryptographic credential separation ensures the Node.js backend receives only an authorization hash—validated via constant-time buffer comparisons (`crypto.timingSafeEqual`)—preventing timing side-channel attacks and eliminating server-side decryption capability.

The system features end-to-end encrypted file sharing (up to 9.5 MB) using ephemeral per-file symmetric keys, an interactive mobile swipe-to-reply gesture engine, live `@mentions` autocomplete, and an audio synthesizer built on the Web Audio API. Its peer-to-peer WebRTC mesh calling architecture incorporates the Perfect Negotiation pattern for glare-free signaling, real-time frequency analysis for active speaker visualization, Picture-in-Picture support, and zero-renegotiation track replacement for seamless screen sharing. All room state and encrypted binary buffers are automatically unlinked and destroyed when participants disconnect.

### Key Technical Highlights
- **Zero-Knowledge Architecture**: Symmetric keys are derived and retained exclusively in client memory; the server functions strictly as an untrusted ciphertext relay.
- **Timing-Attack Immune Authentication**: Constant-time credential verification (`crypto.timingSafeEqual`) eliminates side-channel timing vulnerabilities.
- **Zero-Database Ephemeral Lifecycle**: No SQL, NoSQL, or Redis databases; active rooms and temporary encrypted binaries are destroyed immediately upon participant exit.
- **DTLS-SRTP WebRTC Multimedia Mesh**: Peer-to-peer video/audio calling with live active speaker detection, dynamic tile pinning, and `RTCRtpSender.replaceTrack()` screen sharing.
- **Unbiased Rejection Sampling**: Room secret generation uses cryptographically secure rejection sampling, eliminating modulo bias across 68 characters ($68^{24} \approx 2^{146.1}$ bits of entropy).
- **Comprehensive Automated Verification**: 28-test backend security/fuzzing suite and 13 Playwright end-to-end multi-browser test scenarios.

### Technology Stack
- **Frontend**: React 19, Vite, Vanilla Modern CSS (CSS Custom Properties), Lucide React, Emoji Picker React.
- **Backend**: Node.js 24, Express 5, Socket.IO 4.8, Helmet (strict CSP & HSTS), CORS.
- **APIs & Protocols**: Web Crypto API (SubtleCrypto), WebRTC (RTCPeerConnection, DTLS-SRTP), Web Audio API (AnalyserNode), WebSockets.
- **Testing & Tooling**: Playwright, Oxlint, Concurrently, Node.js Test Harness.

---

## 2. Resume / CV Content

### One-Line Resume Summary
- **Software Engineer / Architect**: Engineered a zero-knowledge, zero-database real-time communication platform utilizing React 19, Node.js, WebCrypto, and WebRTC for end-to-end encrypted messaging and peer-to-peer video streaming.

### Three Strong Resume Bullet Points
- **Architected** an end-to-end encrypted real-time communication platform using React 19, Node.js, and WebCrypto APIs, implementing dual-salt PBKDF2-SHA-256 key derivation to separate encryption from server authorization.
- **Engineered** an ephemeral in-memory backend in Express and Socket.IO that operates without persistent databases, automatically unlinking binary attachments and purging state when rooms empty.
- **Developed** a multi-party WebRTC mesh video calling engine with DTLS-SRTP encryption, implementing Perfect Negotiation for offer-collision handling and seamless screen sharing via `RTCRtpSender.replaceTrack()`.

### Five Achievement-Oriented Bullet Points
- **Architected** a zero-knowledge cryptographic messaging system using client-side AES-256-GCM and PBKDF2 (100,000 iterations), isolating decryption keys to browser RAM and rendering server operators incapable of inspecting payloads.
- **Hardened** backend authentication against side-channel vulnerabilities by implementing constant-time hash comparisons (`crypto.timingSafeEqual`) and sliding-window rate limiters across WebSocket events.
- **Designed** a zero-renegotiation screen-sharing mechanism using native WebRTC track replacement (`replaceTrack`), eliminating connection renegotiation latency during active video calls.
- **Engineered** real-time active speaker detection using Web Audio API `AnalyserNode` frequency spectrum analysis with 200 ms debounce filtering, driving live visual equalizer animations.
- **Automated** end-to-end testing and system reliability using Playwright and a 28-test security fuzzing suite, validating room isolation, XSS immunity, and throughput under 50 concurrent simulated users.

### ATS-Friendly Technical Keywords
`End-to-End Encryption (E2EE)`, `AES-256-GCM`, `PBKDF2-SHA-256`, `Web Crypto API`, `WebRTC`, `RTCPeerConnection`, `DTLS-SRTP`, `Socket.IO`, `WebSockets`, `Node.js`, `Express.js`, `React 19`, `Vite`, `JavaScript (ES2024)`, `Full-Stack Architecture`, `Zero-Knowledge Architecture`, `Constant-Time Algorithms`, `Timing-Safe Comparisons`, `Content Security Policy (CSP)`, `HSTS`, `CORS`, `Playwright`, `Automated Testing`, `Screen Sharing`, `Active Speaker Detection`, `Ephemeral Systems`, `Performance Optimization`, `REST APIs`, `Software Engineering`.

---

## 3. LinkedIn Content

### Option 1: Professional Project Announcement
Excited to share **NijiSamvad** (निजी संवाद), an open-source, zero-knowledge communication platform engineered for complete conversational privacy.

Most messaging platforms retain chat history, metadata, and attachment logs indefinitely on cloud databases. NijiSamvad takes a different approach: **absolute zero persistence**.

Key architectural features:
- **Client-Side Key Derivation**: Symmetric AES-256-GCM keys are derived locally via PBKDF2-SHA-256 (100,000 iterations). Plaintext and keys never leave client RAM.
- **Zero-Database Backend**: Built with Node.js and Socket.IO without SQL or Redis. When the last user leaves a room, all in-memory references and temporary encrypted files are permanently wiped.
- **WebRTC Multimedia Mesh**: Peer-to-peer video calling secured by DTLS-SRTP, featuring live active speaker detection and seamless screen sharing.
- **Cryptographic Hardening**: Constant-time credential checks prevent side-channel timing attacks, while rejection sampling guarantees unbiased secret generation.

Verified with 28 automated security tests and Playwright E2E suites.

Check out the repository on GitHub: https://github.com/tanmay9783/NijiSamvad

#SoftwareEngineering #WebSecurity #Cryptography #WebRTC #ReactJS #NodeJS #OpenSource #Cybersecurity

---

### Option 2: Deep Technical Showcase
How do you build a real-time messaging and video platform that mathematically prevents the server operator from reading user messages?

Here is the cryptographic and architectural breakdown of **NijiSamvad**:

1. **Dual-Salt Key Separation**:
   From a single high-entropy secret, the client derives two distinct artifacts via PBKDF2 (100,000 iterations):
   - `encryptionKey`: Derived with salt `encryption_salt_<room>`, imported as a non-extractable AES-GCM key in browser memory.
   - `authHash`: Derived with salt `auth_salt_<room>`, sent to the server for room gatekeeping.
   Because PBKDF2 is non-invertible and different salts are used, compromising the server provides zero mathematical ability to decrypt payloads.

2. **Constant-Time Validation**:
   Room credentials are evaluated using `crypto.timingSafeEqual` over fixed-length buffers, closing side-channel timing attack vectors.

3. **Glitch-Free Screen Sharing**:
   Instead of triggering full WebRTC SDP renegotiation (which often freezes multi-peer mesh connections), screen sharing substitutes media tracks dynamically across active senders using `RTCRtpSender.replaceTrack()`.

4. **Zero-Database Ephemerality**:
   No persistent database. When the last user disconnects, `destroyRoomIfEmpty` purges active room state and unlinks all temporary binary files.

Full architecture, benchmarks, and threat model documented in the repository:
https://github.com/tanmay9783/NijiSamvad

#WebDev #FullStack #SystemDesign #SoftwareArchitecture #Cryptography #ComputerScience

---

### Option 3: Short Project Update
Proud to announce that **NijiSamvad** now features full automated test coverage:
- 28-test server security, timing-attack, and fuzzing suite
- 13 Playwright end-to-end multi-browser test scenarios
- High-concurrency socket stress tests demonstrating sub-second fan-out across 50 simulated users

Built with React 19, Node.js, WebCrypto, and WebRTC.

GitHub: https://github.com/tanmay9783/NijiSamvad

#OpenSource #JavaScript #ReactJS #NodeJS #WebRTC

---

## 4. Interview Preparation Guide

### 30-Second Elevator Pitch
NijiSamvad is an open-source, zero-knowledge communication platform built with React 19, Node.js, WebCrypto, and WebRTC. It provides end-to-end encrypted messaging, binary file sharing, and peer-to-peer video calling without storing any data in a persistent database. Symmetric keys are derived client-side via PBKDF2, the server operates strictly as an untrusted message relay, and all data is wiped automatically the moment a conversation ends.

### 1-Minute Project Explanation
In an era where digital communication is persistently archived, NijiSamvad provides an ephemeral alternative engineered for total privacy. Using native Web Crypto APIs, client browsers derive 256-bit AES-GCM encryption keys and authorization hashes using PBKDF2 with 100,000 iterations. The backend—built with Node.js, Express, and Socket.IO—acts as a zero-knowledge relay, validating credentials via constant-time comparisons (`crypto.timingSafeEqual`) without having access to decryption keys. 

Beyond text messaging, NijiSamvad supports encrypted binary file attachments up to 9.5 MB using single-use symmetric keys, and multi-party video calling using a WebRTC mesh topology. To ensure usability, it includes live active speaker detection using Web Audio API frequency analysis, screen sharing via track replacement, and a responsive mobile swipe-to-reply gesture system. The entire system operates without a database, guaranteeing zero data persistence.

### 3-Minute Technical Architecture Walkthrough
When designing NijiSamvad, my primary objective was to eliminate persistent server-side risk while maintaining a seamless real-time user experience. The system is divided into four main layers:

1. **Cryptographic Engine**:
   When a user creates or joins a room, they provide a display name, room ID, and a high-entropy secret generated via unbiased rejection sampling. In the client, `deriveKeys()` runs two parallel PBKDF2-SHA-256 operations: one generates the AES-256-GCM `encryptionKey` stored strictly in memory, and the other generates `authHash`. This dual-salt approach ensures that even if an attacker compromises the server and captures `authHash`, they cannot invert PBKDF2 or compute the encryption key. For out-of-band verification, a 24-character hexadecimal visual safety number is computed via SHA-256, allowing users to verify their keys match and rule out Man-in-the-Middle attacks.

2. **Backend Relay & Ephemeral Storage**:
   The server is implemented in Node.js, Express, and Socket.IO. It maintains active state in memory using native JavaScript `Map` objects (`roomsMap`, `attachmentMeta`, `rateLimitsMap`). When a user uploads an attachment, the file is encrypted client-side with a unique single-use AES key. The server stores the raw binary ciphertext in an ephemeral directory. The attachment key itself is encrypted inside the message envelope using the room key and sent over WebSockets. When the last participant leaves a room, `destroyRoomIfEmpty()` synchronously purges the room entry and unlinks all associated attachment files from disk.

3. **WebRTC Mesh Calling**:
   Video calling uses a peer-to-peer mesh architecture secured by DTLS-SRTP. The signaling layer over Socket.IO implements the Perfect Negotiation pattern: if both peers initiate an offer simultaneously, the peer with the lower socket ID acts politely and rolls back its local description. Screen sharing is implemented without renegotiation by calling `RTCRtpSender.replaceTrack()` directly on existing RTP senders. For the UI, I used the Web Audio API's `AnalyserNode` to analyze audio frequency streams, creating a live active speaker detection system that highlights speakers and displays animated soundwaves.

4. **Security Hardening**:
   The backend enforces sliding-window rate limiters per socket (disconnecting abusive connections that exceed 3x thresholds), strict Helmet CSP headers, HSTS, and input length boundaries. The entire system is validated by a 28-test security suite covering timing attacks, traversal attempts, fuzzing, and room isolation.

---

### Key Interview Talking Points

1. **Problem Statement**:
   Centralized communication tools retain perpetual transcripts and metadata on cloud disks, exposing users to subpoena, insider attacks, and forensic leaks. NijiSamvad solves this by enforcing zero-knowledge encryption and total in-memory ephemerality.

2. **Biggest Technical Challenge**:
   Handling WebRTC offer collisions (glare) and screen sharing in a multi-peer mesh without causing audio/video freezes. Resolved by implementing the Perfect Negotiation pattern (polite/impolite peer negotiation) and utilizing `RTCRtpSender.replaceTrack()` instead of triggering expensive full SDP renegotiations.

3. **Most Important Engineering Decision**:
   The dual-salt PBKDF2 credential separation. Deriving `encryptionKey` and `authHash` with distinct salts ensured the server could authenticate room access without ever receiving or possessing the capability to compute the decryption key.

4. **Key Lessons Learned**:
   Deepened expertise in native Web Crypto API capabilities, constant-time algorithms for side-channel attack mitigation, Web Audio API frequency analysis, and WebRTC lifecycle state management.

5. **Trade-offs & Scalability Limitations**:
   The WebRTC mesh topology scales as $O(N^2)$, making it optimal for $\le 6$ users rather than large webinars. For enterprise group calling, an end-to-end encrypted Selective Forwarding Unit (SFU) using SFrame would be the natural next step. Additionally, single-instance in-memory state means horizontal scaling requires an ephemeral pub/sub layer.

---

## 5. 20 Technical Interview Questions & Answers

### Architecture & System Design

#### Q1: Why did you choose a zero-database architecture instead of an encrypted database?
**Answer**: An encrypted database still retains ciphertext, timestamps, room IDs, and connection logs indefinitely on non-volatile physical storage (NVMe/SSD). In sensitive communication environments, ciphertext retention creates perpetual exposure to future cryptographic breaks (e.g., quantum attacks), disk forensic extraction, or legal discovery. By keeping active room state entirely in Node.js volatile memory (`roomsMap`) and unlinking all temporary encrypted files the instant a room empties, NijiSamvad eliminates persistent data residue at the architectural level.

#### Q2: How does the system scale, and what is the primary bottleneck?
**Answer**: For text messaging, the bottleneck is Node.js event-loop CPU overhead during Socket.IO broadcast fan-out ($O(N)$ operations per message in an $N$-user room). Stress testing confirmed smooth performance up to 50 concurrent users per room with sub-second fan-out. For video calling, the bottleneck is client upload bandwidth and CPU decoding in the $O(N^2)$ WebRTC mesh. While the signaling server experiences minimal load, each client must encode and transmit $N-1$ video streams, making $\le 6$ participants the recommended operational threshold.

#### Q3: How would you scale NijiSamvad horizontally across multiple servers without sacrificing privacy?
**Answer**: To scale horizontally across multiple instances behind a load balancer, we would replace the local `roomsMap` with an in-memory ephemeral Redis cluster utilizing the Socket.IO Redis Adapter. To maintain zero persistence, the Redis cluster would be configured with persistence disabled (`save ""` and `appendonly no`). Ephemeral attachments would be stored in an in-memory shared object store (such as a distributed RAM-backed tmpfs mount) and purged via Redis keyspace expiry notifications when room sessions terminate.

#### Q4: How does the application prevent memory leaks when handling high volumes of multimedia messages?
**Answer**: When binary attachments are decrypted on the client, `URL.createObjectURL(decryptedBlob)` allocates memory in the browser's internal blob registry. If unmanaged, these URLs cause significant memory leaks. In `src/App.jsx`, all generated blob URLs are registered in a `blobUrlsRef` Set. When a message is removed, the room is exited (`leaveChat`), or the root component unmounts, the cleanup routine explicitly iterates through the Set and calls `URL.revokeObjectURL(url)`, freeing the allocated memory.

---

### Cryptography & Security

#### Q5: Explain the mathematical rationale behind your dual-salt PBKDF2 key derivation.
**Answer**: PBKDF2 is a cryptographically secure key derivation function:
$$\text{Output} = \text{PBKDF2}(\text{Secret}, \text{Salt}, \text{Iterations}, \text{Length}, \text{Hash})$$
We apply 100,000 iterations of SHA-256. By enforcing distinct salts:
- `encryptionKey` uses `salt = "encryption_salt_" + roomName`
- `authHash` uses `salt = "auth_salt_" + roomName`
Because cryptographic hash functions satisfy the pre-image resistance and pseudorandom function (PRF) security definitions, it is computationally infeasible for anyone possessing `authHash` to invert the function or derive `encryptionKey`. This allows the server to verify room credentials without possessing the key required to decrypt payloads.

#### Q6: What is modulo bias, and how did you resolve it in the secret generator?
**Answer**: When generating random strings, developers often take a random integer and apply the modulo operator: `val % alphabet.length`. If the random integer generator produces values in the range $[0, 2^{32}-1]$ and $2^{32}$ is not evenly divisible by the alphabet size (68 characters in our case), lower remainder values appear with slightly higher probability. To eliminate this bias, `generateSecureRoomSecret()` implements rejection sampling: it calculates `maxValid = 4294967296 - (4294967296 % 68)`. Any random 32-bit integer $\ge \text{maxValid}$ is discarded, guaranteeing an exact uniform distribution across all 68 characters ($68^{24} \approx 2^{146.1}$ bits of entropy).

#### Q7: Why is `crypto.timingSafeEqual` necessary on the server, and what happens if you use standard equality (`===`)?
**Answer**: Standard string equality operators (`===` or `==`) compare characters sequentially from left to right and return `false` at the first mismatch. This creates a timing side-channel: an attacker submitting candidate authentication hashes can measure response latencies down to nanoseconds; a string that matches the first 4 characters takes measurably longer to reject than one that fails on the first character. By converting both strings into fixed-length Node.js `Buffer` objects and calling `crypto.timingSafeEqual`, the comparison execution time remains constant regardless of character matches, closing the side-channel vector.

#### Q8: How does NijiSamvad mitigate Man-in-the-Middle (MITM) attacks if the server is untrusted?
**Answer**: If an untrusted server attempts to MITM users by generating substitute room credentials, the visual safety fingerprint detects the discrepancy. Both clients compute `generateRoomFingerprint()`:
$$\text{Fingerprint} = \text{SHA-256}(\text{roomName} + \text{":"} + \text{secret})\text{.slice}(0, 24)$$
This 24-character hexadecimal string is formatted into readable 4-character blocks (e.g., `A1B2 C3D4 E5F6 7890 1234 5678`). Users can verify this fingerprint out-of-band (via phone call, QR code, or in person). If the server modified the secret or room parameters, the fingerprints will not match.

#### Q9: How is XSS prevented throughout the application?
**Answer**: XSS is mitigated through multiple defense-in-depth layers:
1. **React DOM Auto-Escaping**: Message text and user inputs are rendered as standard React child nodes (`<span>{text}</span>`), which natively escapes HTML entities.
2. **Server Input Sanitization**: Usernames and room names are stripped of `<` and `>` characters before storage in memory.
3. **Strict Content Security Policy (CSP)**: In production, Helmet enforces:
   ```
   default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob:; connect-src 'self' ws: wss: stun:; media-src 'self' blob:;
   ```
   This prevents unauthorized inline script execution and external script injection.

---

### WebRTC & Real-Time Multimedia

#### Q10: How does your WebRTC implementation handle offer collisions (glare)?
**Answer**: In a peer-to-peer mesh where any participant can initiate a call, two clients may emit `webrtc-offer` simultaneously, causing a glare condition where both peer connections enter `have-local-offer` state. We implement the W3C Perfect Negotiation pattern using deterministic socket IDs:
- The peer with `socket.id < callerSocketId` is designated as the "polite" peer.
- When an offer collision occurs, the polite peer yields by rolling back its local description:
  ```javascript
  await peer.setLocalDescription({ type: 'rollback' });
  ```
  It then accepts the incoming remote description and responds with an answer. The impolite peer simply ignores colliding offers while waiting for its own offer to be processed.

#### Q11: Why does screen sharing use `RTCRtpSender.replaceTrack()` instead of full SDP renegotiation?
**Answer**: Full SDP renegotiation requires generating a new offer, transmitting it across the signaling channel, waiting for a remote answer, and setting local/remote descriptions across every active peer in the mesh. In multi-user calls, this exchange frequently introduces race conditions, audio stutter, and video freezes. `RTCRtpSender.replaceTrack(displayTrack)` seamlessly swaps the underlying media source in the existing RTP sender stream without modifying the SDP contract, keeping the call completely uninterrupted.

#### Q12: How does active speaker detection work under the hood?
**Answer**: In `src/components/CallInterface.jsx`, the custom hook `useAudioVolume(stream)` taps into the Web Audio API:
1. Instantiates an `AudioContext` and creates a media stream source node: `audioCtx.createMediaStreamSource(stream)`.
2. Connects the source to an `AnalyserNode` with `fftSize = 128` and `smoothingTimeConstant = 0.4`.
3. In a `requestAnimationFrame` loop, samples frequency data via `analyser.getByteFrequencyData(dataArray)`.
4. Calculates the average volume. If average volume $> 10$, an active speaker state is flagged.
5. Implements a 12-frame (~200 ms) debounce counter before clearing the state to prevent UI flickering during pauses between words.

#### Q13: What happens when ICE candidates arrive before the remote description is set?
**Answer**: If a remote peer emits `webrtc-ice-candidate` before the receiving client has completed `peer.setRemoteDescription()`, calling `peer.addIceCandidate()` throws an `InvalidStateError`. To prevent connection failures, `useWebRTC.js` maintains a `candidateQueueRef`. Any candidate arriving prior to remote description configuration is buffered in an array. Once `setRemoteDescription()` resolves, `flushIceCandidates()` sequentially empties the queue and adds each buffered candidate.

---

### Backend & API Engineering

#### Q14: How does the server enforce rate limiting without external caching engines like Redis?
**Answer**: `server/server.js` implements an in-memory sliding-window counter abstraction (`rateLimitStore`). Each socket maintains a Map of tracked actions (`send`, `typing`, `reaction`, `webrtc`):
- Each action entry tracks `{ count, windowStart }`.
- When an event arrives, if `Date.now() - windowStart > 5000` (5-second window), the counter resets to 1.
- If the count exceeds the threshold (e.g., 10 messages per 5 seconds), the event is dropped.
- If the count exceeds 3x the allowable threshold (e.g., $> 30$ messages in 5 seconds), the server forcefully disconnects the socket (`socket.disconnect(true)`) to mitigate denial-of-service attempts.

#### Q15: How are file attachments streamed securely without exposing plaintext files on disk?
**Answer**:
1. Files are encrypted client-side using a single-use AES-256-GCM key before upload.
2. The upload route `POST /api/attachments` uses `express.raw({ type: 'application/octet-stream', limit: '10mb' })` to process the body directly as a raw binary buffer.
3. The server writes the opaque ciphertext to disk (`uploads/<uuid>.bin`). The server has zero knowledge of the file name, type, or decryption key.
4. When retrieved via `GET /api/attachments/:id`, the server verifies room authorization and streams raw bytes with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
5. The client downloads and decrypts the bytes locally, reconstructing the original file blob in browser memory.

#### Q16: How does the server ensure that cross-room signaling or messaging attacks cannot occur?
**Answer**: In `server/server.js`, every socket handler verifies active room membership:
- `validateWebrtcAuth(targetSocketId)` ensures both the sender and target socket exist within the same room in `roomsMap`.
- Sockets cannot emit `send`, `typing`, `call-*`, or `webrtc-*` events to arbitrary rooms or sockets outside their registered room.
- Attempting to pass a target socket ID belonging to a different room results in silent rejection.

---

### Testing, Quality & Performance

#### Q17: What does the automated server test suite cover?
**Answer**: `tests/test-server.js` contains 28 automated tests covering:
- Cryptographic key entropy and dual-salt isolation verification.
- Room authorization with valid, invalid, missing, and malformed `authHash` payloads.
- Message payload boundaries (accepting valid payloads, rejecting $> 256\text{ KB}$ payloads).
- Ephemeral lifecycle validation (verifying that after the last user leaves, attachment files are deleted from disk and subsequent fetches return 401/404).
- Path traversal protection (e.g., verifying `GET /api/attachments/..%2f..%2fpackage.json` fails).
- Cross-room signaling rejection and rate-limiter abuse penalties.
- Production environment protections (verifying `/api/stats` returns 404 and CORS blocks localhost).

#### Q18: How did you configure Playwright to test WebRTC video and audio in CI/headless environments?
**Answer**: Standard headless browsers do not have physical camera or microphone access, causing `navigator.mediaDevices.getUserMedia` to reject. In `playwright.config.js`, Chromium is launched with specific test flags:
```javascript
launchOptions: {
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream'
  ]
}
```
This instructs Chromium to bypass UI permission dialogs and provide synthetic test video (a synthetic moving color bar) and audio (a synthetic test tone), enabling fully automated E2E testing of multi-user call establishment, track replacement, and teardown.

#### Q19: What were the findings of your load and stress testing?
**Answer**: As documented in `PERFORMANCE.md`, stress testing with `tests/test-load.js` established:
- **Baseline Footprint**: ~75 MB RSS memory at idle.
- **Connection Scalability**: 50 concurrent sockets connected in 202 ms, increasing RSS memory by only 10 MB (to 85 MB).
- **Fan-Out Throughput**: 100 broadcast messages in a 50-user room resulted in 4,900 total message deliveries completed in ~2,000 ms (~2,450 deliveries/second).
- **Teardown Verification**: Disconnecting all sockets returned room counts and disk files to zero, with memory stabilizing at ~103 MB without residual leaks.

#### Q20: What are the main areas of technical debt, and what would you prioritize next?
**Answer**:
1. **Ratchet Protocol Implementation**: Currently, sessions use a static PBKDF2-derived key for their duration. Implementing the Double Ratchet Protocol (Signal protocol) would provide per-message forward and backward secrecy.
2. **Selective Forwarding Unit (SFU)**: To scale video calling beyond 8 participants, implementing an end-to-end encrypted SFU sidecar utilizing WebRTC Insertable Streams (SFrame) would allow media fan-out without requiring the server to decrypt packets.
3. **RAM-Disk Attachment Storage**: Mounting `uploads/` on a native `tmpfs` RAM disk would eliminate physical SSD sector writes entirely, hardening the platform against cloud provider disk snapshots.

