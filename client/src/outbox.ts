import type { Op } from '../../protocol/src/index';

// TODO(M3): IndexedDB stores `pending` (lid, op) and `meta` (lastSeq).
//   queue(op)          -> add to pending, fire and forget
//   onServerOp(msg)    -> dedupe by seq, gap triggers resync
//   onSnapshot(msg)    -> replace local doc
//   flushPending()     -> call *after* `welcome`, not on socket open
export async function queue(_op: Op) {}
