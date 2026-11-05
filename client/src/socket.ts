import type { C2S, S2C } from '../../protocol/src/index';

export class Socket {
  private ws: WebSocket;
  private outbox: C2S[] = [];
  private onMsgCb: ((m: S2C) => void) | null = null;

  constructor(url: string, private room: string, private clientId: string) {
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      this.send({ type: 'hello', room: this.room, clientId: this.clientId, lastSeq: 0 });
      for (const m of this.outbox.splice(0)) this.ws.send(JSON.stringify(m));
    });

    this.ws.addEventListener('message', (e) => {
      try { this.onMsgCb?.(JSON.parse(String(e.data)) as S2C); } catch {}
    });

    this.ws.addEventListener('close', () => console.log('[ws] closed — reconnect lands in M3'));
  }

  send(m: C2S) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else this.outbox.push(m);
  }

  onMessage(cb: (m: S2C) => void) { this.onMsgCb = cb; }
}