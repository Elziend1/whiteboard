import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { applyOp, type C2S, type S2C, type DocState } from '../../protocol/src/index';
import { validateCoupon } from './coupons';
import { saveOp, loadOps } from './db';

const PORT = Number(process.env.PORT ?? 8080);

// --- HTTP API ---
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/coupons/check') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { code, plan } = JSON.parse(body);
        const basePrice = plan === 'pro' ? 1200 : 0;
        const result = validateCoupon(code, plan, basePrice);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// --- WebSocket Server ---
interface Room {
  seq: number;
  clients: Set<WebSocket>;
  state: DocState;
}

const rooms = new Map<string, Room>();

function getRoom(id: string): Room {
  let r = rooms.get(id);
  if (!r) {
    r = { seq: 0, clients: new Set(), state: { strokes: {}, notes: {} } };
    
    // M2: Load history from SQLite on room creation
    const history = loadOps(id);
    for (const entry of history) {
      applyOp(r.state, entry.op);
      r.seq = Math.max(r.seq, entry.seq);
    }
    
    if (history.length > 0) {
      console.log(`[db] Restored room "${id}" with ${history.length} ops.`);
    }
    
    rooms.set(id, r);
  }
  return r;
}

function send(ws: WebSocket, m: S2C) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
}

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let joined: { room: string; clientId: string } | null = null;

  ws.on('message', (raw) => {
    let msg: C2S;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    if (msg.type === 'hello') {
      joined = { room: msg.room, clientId: msg.clientId };
      const room = getRoom(msg.room);
      room.clients.add(ws);
      
      send(ws, { type: 'snapshot', seq: room.seq, state: room.state });
      send(ws, { type: 'welcome', seq: room.seq });
      return;
    }

    if (!joined) return;
    const room = getRoom(joined.room);

    if (msg.type === 'ping') { send(ws, { type: 'pong' }); return; }

    if (msg.type === 'op') {
      const seq = ++room.seq;
      
      // M2: Apply and save to SQLite!
      applyOp(room.state, msg.op);
      saveOp(joined.room, seq, joined.clientId, msg.op);

      const out: S2C = { type: 'op', seq, clientId: joined.clientId, op: msg.op, lid: msg.lid };
      for (const c of room.clients) if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(out));
      return;
    }

    if (msg.type === 'cursor') {
      const out: S2C = { type: 'cursor', clientId: joined.clientId, x: msg.x, y: msg.y };
      for (const c of room.clients) {
        if (c !== ws && c.readyState === WebSocket.OPEN) c.send(JSON.stringify(out));
      }
      return;
    }
  });

  ws.on('close', () => {
    if (!joined) return;
    getRoom(joined.room).clients.delete(ws);
  });
});

server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));