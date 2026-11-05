export type ClientId = string;
export type Seq = number;
export interface Point { x: number; y: number; p?: number }

export type ToolType = 'pen' | 'ruler' | 'laser' | 'highlighter' | 'eraser' | 'shape' | 'hand';
export type ShapeType = 'rect' | 'circle' | 'triangle';
export type PenType = 'solid' | 'dashed' | 'dotted';
export type BackgroundType = 'blank' | 'lined' | 'grid' | 'dot';

export interface Page {
  id: string;
  background: BackgroundType;
}

export interface Stroke {
  id: string; kind: 'stroke'; author: ClientId;
  pageId?: string; // NEW: Links stroke to a specific page
  tool: ToolType; shape?: ShapeType; penStyle?: PenType;
  color: string; width: number; points: Point[];
}

export interface Note {
  id: string; kind: 'note'; author: ClientId;
  x: number; y: number; w: number; h: number;
  text: string; updatedAt: number;
}

export type Op =
  | { t: 'stroke.begin'; stroke: Omit<Stroke, 'points'> & { points: Point[] } }
  | { t: 'stroke.points'; id: string; points: Point[] }
  | { t: 'stroke.delete'; id: string }
  | { t: 'page.upsert'; page: Page } // NEW: Create/update a page
  | { t: 'note.upsert'; note: Note }
  | { t: 'note.delete'; id: string }
  | { t: 'clear' };

export interface DocState {
  strokes: Record<string, Stroke>;
  notes: Record<string, Note>;
  pages: Record<string, Page>; // NEW
}

export type C2S =
  | { type: 'hello'; room: string; clientId: ClientId; lastSeq: Seq }
  | { type: 'op'; op: Op; lid?: number }
  | { type: 'cursor'; x: number; y: number }
  | { type: 'ping' };

export type S2C =
  | { type: 'welcome'; seq: Seq }
  | { type: 'snapshot'; seq: Seq; state: DocState }
  | { type: 'op'; seq: Seq; clientId: ClientId; op: Op; lid?: number }
  | { type: 'cursor'; clientId: ClientId; x: number; y: number }
  | { type: 'pong' };

export type PlanId = 'free' | 'pro';
export interface Plan { id: PlanId; name: string; priceCents: number; interval: 'month' | null; maxRooms: number; maxCollaborators: number; features: string[]; }
export interface CouponCheckRequest { code: string; plan: PlanId }
export interface CouponCheckResponse { valid: boolean; reason?: 'unknown' | 'expired' | 'exhausted' | 'already_redeemed'; percentOff?: number; finalPriceCents?: number; }

export function applyOp(state: DocState, op: Op) {
  if (!state.pages) state.pages = {}; // Migration for old rooms
  if (!state.pages['page-1']) state.pages['page-1'] = { id: 'page-1', background: 'blank' };

  switch (op.t) {
    case 'stroke.begin':
      if (!state.strokes[op.stroke.id]) {
        state.strokes[op.stroke.id] = { 
          ...op.stroke, 
          points: [...op.stroke.points],
          pageId: op.stroke.pageId || 'page-1' // Default to page 1 for old strokes
        };
      }
      break;
    case 'stroke.points': {
      const s = state.strokes[op.id];
      if (s) s.points.push(...op.points);
      break;
    }
    case 'stroke.delete': delete state.strokes[op.id]; break;
    case 'page.upsert': state.pages[op.page.id] = { ...op.page }; break;
    case 'note.upsert': {
      const cur = state.notes[op.note.id];
      if (!cur || cur.updatedAt <= op.note.updatedAt) state.notes[op.note.id] = { ...op.note };
      break;
    }
    case 'note.delete': delete state.notes[op.id]; break;
    case 'clear': state.strokes = {}; state.notes = {}; break;
  }
}