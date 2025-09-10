# Against-ChatControl
This repo contains a minimal **end-to-end encrypted** chat app (client + lightweight signaling server).

Principles:
- Clients perform ECDH (P-256) key agreement with each peer.
- Messages are encrypted with per-peer AES-GCM keys derived from ECDH.
- Server only relays signaling and ciphertext — it never sees plaintext keys.

Included files:
- client (React single-file app: `src/App.jsx`)
- server (Node.js express + ws: `index.js`)
- README usage notes below.

## Quick start

### Server
1. `cd server`
2. `npm install` (express, ws, cors)
3. `node index.js` (defaults to port 3001)

### Client (dev)
1. `cd client`
2. `npm install`
3. `npm run dev` or `npm start` depending on your bundler
4. Open the app, choose a room name and username, connect.

Notes & limitations:
- This is a minimal demo. For production, add authentication, certificate checks, message ordering, replay protection, group key management, persistent message storage (server should store ciphertext only), offline delivery, and UI polish.
- ECDH with P-256 and AES-GCM is used; consider X25519 + HKDF + AES-GCM or AES-SIV for stronger guarantees in production.
*/
