This repo contains a minimal **end-to-end encrypted** chat app (client + lightweight signaling server).
1. Ensure Node.js (>=16) and npm are installed. On Linux:
```bash
sudo apt update
sudo apt install -y nodejs npm # Debian/Ubuntu
# or
sudo dnf install -y nodejs npm # Fedora
# or use nvm for latest Node: https://github.com/nvm-sh/nvm
```


2. Start the server:
```bash
cd server
npm install
node server-index.js
```
The server listens on port 3001 by default.


### Client (Linux / macOS / Windows)


1. In a separate terminal:
```bash
cd client
npm install
npm run dev # or: npm start, depending on your bundler (Vite, CRA, etc.)
```


2. Open the URL shown in the console (usually http://localhost:5173 or http://localhost:3000).


3. Enter a room name and username, then connect.


### Notes & limitations
- This is a minimal demo. For production, add authentication, certificate checks, message ordering, replay protection, group key management, persistent message storage (server should store ciphertext only), offline delivery, and UI polish.
- ECDH with P-256 and AES-GCM is used; consider X25519 + HKDF + AES-GCM or AES-SIV for stronger guarantees in production.
- 

Notes & limitations:
- This is a minimal demo. For production, add authentication, certificate checks, message ordering, replay protection, group key management, persistent message storage (server should store ciphertext only), offline delivery, and UI polish.
- ECDH with P-256 and AES-GCM is used; consider X25519 + HKDF + AES-GCM or AES-SIV for stronger guarantees in production.
*/
