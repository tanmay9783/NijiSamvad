# Deployment Guide

SecureChat is designed to be hosted as a **single-instance Node.js backend** with a **statically served React frontend**. 

The architecture is **ephemeral**. This means if the server is restarted or crashes, all active rooms and attachments are immediately destroyed. It does NOT support horizontal scaling (running multiple instances behind a load balancer) without external infrastructure (like Redis) which is out of scope.

## Prerequisites
- Node.js >= 18
- HTTPS/WSS (Strictly required for production, configured via a reverse proxy like Nginx or Cloudflare)

## 1. Single-Instance Deployment (Simplest)

In this deployment model, the Node.js server acts as both the WebSocket/API backend AND the static file host for the React frontend.

1. **Clone the Repository**
2. **Install Dependencies**
   ```bash
   npm install
   ```
3. **Build the Frontend**
   ```bash
   npm run build
   ```
   *This compiles the React app into the `dist/` directory.*
4. **Configure Environment**
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   PORT=5000
   NODE_ENV=production
   CLIENT_ORIGIN=https://your-domain.com
   ```
5. **Start the Server**
   ```bash
   npm start
   ```
   *The server will now bind to the specified port. It will automatically wipe the `uploads/` directory on startup to enforce ephemeral guarantees.*

## 2. Separate Deployment (Optional)

If you prefer to host the frontend on a CDN (like Vercel or Netlify) and the backend on a VPS (like DigitalOcean or Render):

1. **Backend (VPS)**:
   Deploy the Node.js app as usual, but the frontend files in `dist/` won't be requested. Ensure `CLIENT_ORIGIN` matches your CDN domain.
2. **Frontend (CDN)**:
   Set the `VITE_API_URL` environment variable during the Vite build:
   ```bash
   VITE_API_URL=https://your-backend-domain.com npm run build
   ```

## 3. Mandatory Reverse Proxy Requirements
Because Socket.IO sends the `authHash` within the connection handshake, **you must use TLS/SSL (HTTPS/WSS)** in production to prevent Man-in-the-Middle (MITM) attacks.

### Example Nginx Configuration
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL Config...

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 4. Operational Limits
- **Chat Room Limit**: Several hundred users per room (bottlenecked by CPU fan-out).
- **WebRTC Call Limit**: ≤ 6 users recommended (bottlenecked by client upload bandwidth).
- **Attachment Size**: 9.5 MB plaintext (strictly enforced before encryption overhead).

## 5. Graceful Shutdown
The server handles `SIGINT` and `SIGTERM`. Upon receiving a shutdown signal, it will safely disconnect active sockets, clear the ephemeral `uploads/` attachment directory, and cleanly exit. 
