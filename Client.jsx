import React, { useEffect, useRef, useState } from 'react';

export default function App() {
  const [serverUrl, setServerUrl] = useState('ws://localhost:3001');
  const [room, setRoom] = useState('test-room');
  const [username, setUsername] = useState(() => 'user' + Math.floor(Math.random()*1000));
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [peerMap, setPeerMap] = useState({}); // id -> { username, pubkey (base64) }
  const [youId, setYouId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  // crypto keys
  const privateKeyRef = useRef(null);
  const publicKeyB64Ref = useRef(null);

  // helper: arraybuffer <-> base64
  function ab2b64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function b642ab(b64) {
    const s = atob(b64);
    const arr = new Uint8Array(s.length);
    for (let i=0;i<s.length;i++) arr[i]=s.charCodeAt(i);
    return arr.buffer;
  }

  async function genKeyPair() {
    const kp = await window.crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
    const pub = await window.crypto.subtle.exportKey('raw', kp.publicKey); // raw bytes
    privateKeyRef.current = kp.privateKey;
    publicKeyB64Ref.current = ab2b64(pub);
  }

  async function importPeerPublicKey(b64) {
    const raw = b642ab(b64);
    return await window.crypto.subtle.importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  }

  async function deriveAesKey(peerPubB64) {
    const peerPub = await importPeerPublicKey(peerPubB64);
    const derivedKey = await window.crypto.subtle.deriveKey(
      { name: 'ECDH', public: peerPub },
      privateKeyRef.current,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt','decrypt']
    );
    return derivedKey;
  }

  async function encryptForPeer(peerId, plaintext) {
    const peer = peerMap[peerId];
    if (!peer || !peer.pubkey) throw new Error('peer has no pubkey');
    const aes = await deriveAesKey(peer.pubkey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder().encode(plaintext);
    const ct = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, enc);
    return { iv: ab2b64(iv.buffer), ct: ab2b64(ct) };
  }

  async function decryptFromPeer(fromId, ivB64, ctB64) {
    const peer = peerMap[fromId];
    if (!peer || !peer.pubkey) throw new Error('peer has no pubkey');
    const aes = await deriveAesKey(peer.pubkey);
    const iv = b642ab(ivB64);
    const ct = b642ab(ctB64);
    const pt = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, aes, ct);
    return new TextDecoder().decode(pt);
  }

  useEffect(() => {
    genKeyPair();
  }, []);

  // connect to signaling server
  async function connect() {
    const socket = new WebSocket(serverUrl);
    socket.addEventListener('open', () => {
      setConnected(true);
      // send join
      socket.send(JSON.stringify({ type: 'join', room, username }));
    });

    socket.addEventListener('message', async (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === 'peers') {
        setYouId(data.you);
        // add peers
        const map = {};
        for (const p of data.peers) map[p.id] = { username: p.username, pubkey: p.pubkey };
        setPeerMap(prev => ({...prev, ...map}));
        // announce our pubkey
        socket.send(JSON.stringify({ type: 'announce-pubkey', pubkey: publicKeyB64Ref.current }));
      }
      if (data.type === 'peer-joined') {
        setPeerMap(prev => ({ ...prev, [data.id]: { username: data.username, pubkey: null } }));
      }
      if (data.type === 'peer-pubkey') {
        setPeerMap(prev => ({ ...prev, [data.id]: { ...(prev[data.id]||{}), pubkey: data.pubkey } }));
      }
      if (data.type === 'peer-left') {
        setPeerMap(prev => { const copy={...prev}; delete copy[data.id]; return copy; });
      }

      if (data.type === 'encr-message') {
        try {
          const pt = await decryptFromPeer(data.from, data.iv, data.ct);
          setMessages(m => [...m, { from: data.from, username: peerMap[data.from]?.username || data.from, text: pt }]);
        } catch (e) {
          console.warn('decrypt failed', e);
        }
      }

      if (data.type === 'broadcast-encr-message') {
        // group broadcast: try decrypting
        try {
          const pt = await decryptFromPeer(data.from, data.iv, data.ct);
          setMessages(m => [...m, { from: data.from, username: peerMap[data.from]?.username || data.from, text: pt }]);
        } catch (e) {
          // can't decrypt if not intended
        }
      }
    });

    socket.addEventListener('close', () => setConnected(false));
    setWs(socket);
  }

  async function sendMessage() {
    if (!ws) return;
    // naive: encrypt separately for each peer and send to them individually
    for (const peerId of Object.keys(peerMap)) {
      if (!peerMap[peerId].pubkey) continue;
      try {
        const { iv, ct } = await encryptForPeer(peerId, text);
        ws.send(JSON.stringify({ type: 'encr-message', to: peerId, iv, ct }));
        setMessages(m => [...m, { from: youId, username: username + ' (you)', text }]);
      } catch (e) {
        console.warn('encrypt fail for', peerId, e);
      }
    }
    setText('');
  }

  return (
    <div className="min-h-screen p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl mb-4">nē — E2EE room chat</h1>
        <div className="space-y-2 mb-4">
          <input className="p-2 border rounded" value={serverUrl} onChange={e=>setServerUrl(e.target.value)} />
          <input className="p-2 border rounded" value={room} onChange={e=>setRoom(e.target.value)} />
          <input className="p-2 border rounded" value={username} onChange={e=>setUsername(e.target.value)} />
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded" onClick={connect} disabled={connected}>Connect</button>
            <div className="px-3 py-1">{connected ? 'Connected' : 'Disconnected'}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="h-96 overflow-auto border p-2 rounded mb-2">
              {messages.map((m,i)=> (
                <div key={i} className="mb-2">
                  <strong>{m.username}:</strong> <span>{m.text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 p-2 border rounded" value={text} onChange={e=>setText(e.target.value)} />
              <button className="px-3 py-1 border rounded" onClick={sendMessage}>Send</button>
            </div>
          </div>
          <div>
            <h3 className="font-semibold">Peers</h3>
            <ul>
              {Object.entries(peerMap).map(([id,p])=> (
                <li key={id} className="mb-1 break-all">{p.username || id} {p.pubkey? '(has pubkey)':'(no pubkey yet)'}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
      }
