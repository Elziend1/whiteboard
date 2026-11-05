import Database from 'better-sqlite3';

export const db = new Database('./app.db');

// Initialize the database table
db.exec(`
  CREATE TABLE IF NOT EXISTS ops (
    room TEXT,
    seq INTEGER,
    client_id TEXT,
    op_json TEXT,
    PRIMARY KEY(room, seq)
  );
`);

export function saveOp(room: string, seq: number, clientId: string, op: any) {
  const stmt = db.prepare('INSERT INTO ops (room, seq, client_id, op_json) VALUES (?, ?, ?, ?)');
  stmt.run(room, seq, clientId, JSON.stringify(op));
}

export function loadOps(room: string): { seq: number, clientId: string, op: any }[] {
  const stmt = db.prepare('SELECT seq, client_id, op_json FROM ops WHERE room = ? ORDER BY seq ASC');
  const rows = stmt.all(room) as { seq: number, client_id: string, op_json: string }[];
  
  return rows.map(r => ({
    seq: r.seq,
    clientId: r.client_id,
    op: JSON.parse(r.op_json)
  }));
}