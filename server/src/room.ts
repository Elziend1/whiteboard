import type { Op, DocState, S2C } from '../../protocol/src/index';

// TODO(M1): implement apply/commit/onJoin as designed.
// Key invariants:
//   - rejected ops do NOT consume a seq
//   - lastSeq drives the replay path (snapshot fallback if out of range)
export class Room {
  seq = 0;
  snapSeq = 0;
  state: DocState = { strokes: {}, notes: {} };

  apply(_op: Op, _clientId: string): boolean { return false; }
  commit(_op: Op, _clientId: string): void {}
  onJoin(_client: { id: string; send: (m: S2C) => void }, _lastSeq: number): void {}
  broadcast(_m: S2C): void {}
}
