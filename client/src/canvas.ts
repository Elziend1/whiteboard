import { applyOp, type DocState, type Op, type Point, type ToolType, type ShapeType, type BackgroundType } from '../../protocol/src/index';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class Canvas {
  private state: DocState = { strokes: {}, notes: {}, pages: {} };
  private drawing: { id: string; points: Point[]; tool: ToolType; shape?: ShapeType } | null = null;
  private flushTimer: number | null = null;
  private ctx: CanvasRenderingContext2D;
  private onOpCb: ((op: Op) => void) | null = null;

  // Undo / Redo Stacks
  private undoStack: Op[] = [];
  private redoStack: Op[] = [];

  public camera = { x: 0, y: 0, zoom: 1 };
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private spacePressed = false;
  private pdfBackground: ImageBitmap | null = null;

  public boardType: string;
  public currentPageId = 'page-1';
  public currentPageNumber = 1;

  public currentTool: ToolType = 'pen';
  public currentShape: ShapeType = 'rect';
  public isPro = false; 

  private colorInput = document.getElementById('color-picker') as HTMLInputElement;
  private sizeInput = document.getElementById('brush-size') as HTMLInputElement;
  private clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
  private pageLabel = document.getElementById('page-label') as HTMLSpanElement;
  private noteEditor = document.getElementById('note-editor') as HTMLTextAreaElement;

  constructor(private el: HTMLCanvasElement, private myId: string, boardType: string) {
    this.ctx = el.getContext('2d')!;
    this.boardType = boardType;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    el.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    window.addEventListener('keydown', (e) => { 
      if (e.code === 'Space') this.spacePressed = true; 
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) this.redo();
        else this.undo();
      }
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.spacePressed = false; });

    this.clearBtn.addEventListener('click', () => {
      if (confirm('Clear the whole board?')) {
        this.executeOp({ t: 'clear' });
      }
    });

    this.noteEditor.addEventListener('blur', () => {
      const noteId = this.noteEditor.dataset.noteId;
      if (noteId) {
        const text = this.noteEditor.value;
        const n = this.state.notes[noteId];
        if (n) {
           this.executeOp({ t: 'note.upsert', note: { ...n, text, updatedAt: Date.now() } });
        }
      }
      this.noteEditor.style.display = 'none';
    });
  }

  onOp(cb: (op: Op) => void) { this.onOpCb = cb; }
  getRect() { return this.el.getBoundingClientRect(); }
  
  // Centralized execution for Local Ops
  private executeOp(op: Op) {
    applyOp(this.state, op);
    this.onOpCb?.(op);
    this.render();
    
    // Save to history (don't save undo/redo ops to avoid loops)
    if (!op.t.startsWith('clear')) {
      this.undoStack.push(op);
      this.redoStack = [];
    }
  }

  undo() {
    const op = this.undoStack.pop();
    if (!op) return;
    this.redoStack.push(op);
    
    // Generate Inverse Op
    let inv: Op | null = null;
    if (op.t === 'stroke.begin') inv = { t: 'stroke.delete', id: op.stroke.id };
    if (op.t === 'stroke.points') { /* we skip granular point undo for simplicity */ }
    if (op.t === 'note.upsert') inv = { t: 'note.delete', id: op.note.id };
    // Note: we'd need to store deleted stroke data to undo a delete properly. 
    // For this MVP, we skip undoing deletes.

    if (inv) {
       applyOp(this.state, inv);
       this.onOpCb?.(inv);
       this.render();
    }
  }

  redo() {
    const op = this.redoStack.pop();
    if (!op) return;
    this.undoStack.push(op);
    applyOp(this.state, op);
    this.onOpCb?.(op);
    this.render();
  }

  async loadPdf(data: ArrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const offscreen = document.createElement('canvas');
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;
    const ctx = offscreen.getContext('2d')!;
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    this.pdfBackground = await createImageBitmap(offscreen);
    this.render();
  }

  applyRemote(op: Op) { 
    applyOp(this.state, op); 
    this.render(); 
  }
  
  applySnapshot(state: DocState) { 
    this.state = state; 
    if (!this.state.pages) this.state.pages = { 'page-1': { id: 'page-1', background: 'blank' } };
    if (!this.state.pages[this.currentPageId]) {
       this.state.pages[this.currentPageId] = { id: this.currentPageId, background: 'blank' };
    }
    this.render(); 
  }

  setTool(tool: ToolType, shape?: ShapeType) { 
    this.currentTool = tool; 
    if (shape) this.currentShape = shape;
  }
  setColor(color: string) { this.colorInput.value = color; }

  nextPage() {
    if (this.boardType !== 'notebook') return;
    this.currentPageNumber++;
    this.currentPageId = `page-${this.currentPageNumber}`;
    this.pageLabel.textContent = this.currentPageNumber.toString();
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.render();
  }

  prevPage() {
    if (this.boardType !== 'notebook' || this.currentPageNumber <= 1) return;
    this.currentPageNumber--;
    this.currentPageId = `page-${this.currentPageNumber}`;
    this.pageLabel.textContent = this.currentPageNumber.toString();
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.render();
  }

  setBackground(bg: BackgroundType) {
    const page = this.state.pages[this.currentPageId] || { id: this.currentPageId, background: 'blank' };
    this.executeOp({ t: 'page.upsert', page: { ...page, background: bg } });
  }

  pickColor(x: number, y: number): string | null {
    const rect = this.getRect();
    const dpr = window.devicePixelRatio || 1;
    const p = this.ctx.getImageData((x - rect.left) * dpr, (y - rect.top) * dpr, 1, 1).data;
    if (p[3] === 0) return null;
    return `#${((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1)}`;
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.getRect();
    this.el.width = rect.width * dpr;
    this.el.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  private pt(e: PointerEvent | WheelEvent): Point { 
    const rect = this.getRect();
    return { 
      x: (e.clientX - rect.left - this.camera.x) / this.camera.zoom, 
      y: (e.clientY - rect.top - this.camera.y) / this.camera.zoom 
    }; 
  }

  private wheel(e: WheelEvent) {
    if (this.boardType === 'notebook') return;
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const newZoom = Math.max(0.1, Math.min(5, this.camera.zoom - e.deltaY * zoomSensitivity));
    
    const rect = this.getRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.camera.x = mouseX - (mouseX - this.camera.x) * (newZoom / this.camera.zoom);
    this.camera.y = mouseY - (mouseY - this.camera.y) * (newZoom / this.camera.zoom);
    this.camera.zoom = newZoom;
    
    this.render();
  }

  private handleDoubleClick(e: MouseEvent) {
    const p = this.pt(e as any);
    // Find if we clicked on a note
    for (const n of Object.values(this.state.notes)) {
      if (p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h) {
        // Open Editor
        this.noteEditor.style.display = 'block';
        this.noteEditor.value = n.text;
        this.noteEditor.dataset.noteId = n.id;
        
        // Position the editor over the canvas note
        const rect = this.getRect();
        this.noteEditor.style.left = `${(n.x * this.camera.zoom) + this.camera.x}px`;
        this.noteEditor.style.top = `${(n.y * this.camera.zoom) + this.camera.y}px`;
        this.noteEditor.style.width = `${n.w}px`;
        this.noteEditor.style.height = `${n.h}px`;
        this.noteEditor.focus();
        return;
      }
    }
  }

  private down(e: PointerEvent) {
    if (this.boardType === 'infinite' && (this.currentTool === 'hand' || this.spacePressed || e.button === 1)) {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
      this.el.style.cursor = 'grabbing';
      return;
    }

    if (this.drawing) return;
    const p = this.pt(e);

    if (this.currentTool === 'note') {
      const id = crypto.randomUUID();
      this.executeOp({
        t: 'note.upsert',
        note: { id, kind: 'note', author: this.myId, x: p.x, y: p.y, w: 200, h: 150, text: "Double-click to edit", updatedAt: Date.now() }
      });
      return;
    }

    if (this.currentTool === 'eraser') {
      const eraseRadius = 20 / this.camera.zoom;
      
      // Erase Notes
      for (const n of Object.values(this.state.notes)) {
        if (p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h) {
          this.executeOp({ t: 'note.delete', id: n.id });
          return;
        }
      }

      // Erase Strokes
      for (const s of Object.values(this.state.strokes)) {
        if (this.boardType === 'notebook' && s.pageId !== this.currentPageId) continue;
        for (const pt of s.points) {
          if (Math.hypot(pt.x - p.x, pt.y - p.y) < eraseRadius + s.width) {
            this.executeOp({ t: 'stroke.delete', id: s.id });
            return;
          }
        }
      }
      return;
    }

    if (this.currentTool === 'laser') {
      this.drawing = { id: crypto.randomUUID(), points: [p], tool: 'laser' };
      return;
    }
    
    const id = crypto.randomUUID();
    this.drawing = { id, points: [p], tool: this.currentTool, shape: this.currentShape };
    
    this.executeOp({
      t: 'stroke.begin',
      stroke: { 
        id, kind: 'stroke', author: this.myId, tool: this.currentTool, shape: this.currentShape,
        pageId: this.currentPageId,
        color: this.currentTool === 'laser' ? '#ff0000' : this.colorInput.value, 
        width: Number(this.sizeInput.value), points: [p] 
      },
    });
    
    this.el.setPointerCapture(e.pointerId);
  }

  private move(e: PointerEvent) {
    if (this.isPanning) {
      this.camera.x = e.clientX - this.panStart.x;
      this.camera.y = e.clientY - this.panStart.y;
      this.render();
      return;
    }

    if (!this.drawing) return;
    const p = this.pt(e);
    
    if (this.drawing.tool === 'ruler' || this.drawing.tool === 'shape') {
      this.drawing.points[1] = p;
      this.render(); 
      return;
    }

    this.drawing.points.push(p);
    if (this.flushTimer == null) {
      this.flushTimer = window.setTimeout(() => { this.flushTimer = null; this.flushPoints(); }, 50);
    }
  }

  private flushPoints() {
    if (!this.drawing || this.drawing.tool === 'laser') return;
    const s = this.state.strokes[this.drawing.id];
    const from = s ? s.points.length : 0;
    const fresh = this.drawing.points.slice(from);
    if (!fresh.length) return;
    
    // We don't push stroke.points to undoStack to avoid spamming it 100x per stroke.
    // We only push the 'stroke.begin' to undo the whole stroke.
    const op: Op = { t: 'stroke.points', id: this.drawing.id, points: fresh };
    applyOp(this.state, op);
    this.onOpCb?.(op);
    this.render();
  }

  private up(e: PointerEvent) {
    if (this.isPanning) {
      this.isPanning = false;
      this.el.style.cursor = this.currentTool === 'hand' ? 'grab' : 'crosshair';
      return;
    }

    if (this.flushTimer != null) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    
    if (this.drawing?.tool === 'laser') {
      const laserId = this.drawing.id;
      setTimeout(() => {
        if (this.state.strokes[laserId]) {
          applyOp(this.state, { t: 'stroke.delete', id: laserId });
          this.render();
        }
      }, 500);
      this.drawing = null;
      this.render();
      return;
    }

    this.flushPoints();
    this.drawing = null;
  }

  private drawPaper(w: number, h: number) {
    const c = this.ctx;
    
    // Draw PDF Background if it exists
    if (this.pdfBackground) {
      c.drawImage(this.pdfBackground, 0, 0);
    }

    const spacing = 40;
    const startX = Math.floor(-this.camera.x / this.camera.zoom / spacing) * spacing;
    const startY = Math.floor(-this.camera.y / this.camera.zoom / spacing) * spacing;
    const endX = startX + (w / this.camera.zoom) + spacing * 2;
    const endY = startY + (h / this.camera.zoom) + spacing * 2;

    c.strokeStyle = getComputedStyle(document.body).getPropertyValue('--paper-line').trim();
    c.fillStyle = c.strokeStyle;
    c.lineWidth = 1 / this.camera.zoom;

    if (this.boardType === 'notebook') {
      const pageW = 800;
      const pageH = 1130;
      
      if (!this.pdfBackground) {
        c.fillStyle = getComputedStyle(document.body).getPropertyValue('--canvas-bg').trim();
        c.shadowColor = 'rgba(0,0,0,0.2)';
        c.shadowBlur = 20;
        c.fillRect(0, 0, pageW, pageH);
        c.shadowBlur = 0;
      }
      
      c.save();
      c.beginPath(); c.rect(0, 0, pageW, pageH); c.clip();
      
      const pageBg = this.state.pages[this.currentPageId]?.background || 'blank';
      c.strokeStyle = getComputedStyle(document.body).getPropertyValue('--paper-line').trim();
      c.fillStyle = c.strokeStyle;

      if (pageBg === 'lined') {
        for (let y = 40; y < pageH; y += spacing) { c.beginPath(); c.moveTo(0, y); c.lineTo(pageW, y); c.stroke(); }
      } else if (pageBg === 'grid') {
        for (let x = 0; x < pageW; x += spacing) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, pageH); c.stroke(); }
        for (let y = 0; y < pageH; y += spacing) { c.beginPath(); c.moveTo(0, y); c.lineTo(pageW, y); c.stroke(); }
      } else if (pageBg === 'dot') {
        for (let x = 20; x < pageW; x += spacing) {
          for (let y = 20; y < pageH; y += spacing) {
            c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill();
          }
        }
      }
      c.restore();
      return;
    }

    const bg = this.state.pages[this.currentPageId]?.background || 'blank';
    if (bg === 'lined') {
      for (let y = startY; y < endY; y += spacing) { c.beginPath(); c.moveTo(startX, y); c.lineTo(endX, y); c.stroke(); }
    } else if (bg === 'grid') {
      for (let x = startX; x < endX; x += spacing) { c.beginPath(); c.moveTo(x, startY); c.lineTo(x, endY); c.stroke(); }
      for (let y = startY; y < endY; y += spacing) { c.beginPath(); c.moveTo(startX, y); c.lineTo(endX, y); c.stroke(); }
    } else if (bg === 'dot') {
      for (let x = startX; x < endX; x += spacing) {
        for (let y = startY; y < endY; y += spacing) {
          c.beginPath(); c.arc(x, y, 1.5 / this.camera.zoom, 0, Math.PI * 2); c.fill();
        }
      }
    }
  }

  render() {
    const c = this.ctx;
    const w = this.el.width / (window.devicePixelRatio || 1);
    const h = this.el.height / (window.devicePixelRatio || 1);
    
    c.clearRect(0, 0, w, h);
    
    c.save();
    c.translate(this.camera.x, this.camera.y);
    c.scale(this.camera.zoom, this.camera.zoom);

    if (this.boardType === 'notebook') {
       this.camera.x = (w - 800) / 2; 
       this.camera.y = (h - 1130) / 2;
       c.translate(this.camera.x, this.camera.y);
    }

    this.drawPaper(w, h);

    for (const s of Object.values(this.state.strokes)) {
      if (this.boardType === 'notebook' && s.pageId !== this.currentPageId) continue;
      
      const first = s.points[0];
      if (!first) continue;
      
      c.strokeStyle = s.color;
      c.lineWidth = s.width;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      
      if (s.tool === 'highlighter') { c.globalAlpha = 0.3; c.lineWidth = s.width * 4; } else { c.globalAlpha = 1; }

      c.beginPath();
      c.moveTo(first.x, first.y);
      const last = s.points[s.points.length - 1]!;

      if (s.tool === 'ruler') {
        c.lineTo(last.x, last.y);
      } else if (s.tool === 'shape') {
        if (s.shape === 'rect') c.rect(first.x, first.y, last.x - first.x, last.y - first.y);
        else if (s.shape === 'circle') {
          const rx = Math.abs(last.x - first.x) / 2;
          const ry = Math.abs(last.y - first.y) / 2;
          c.ellipse(first.x + (last.x - first.x)/2, first.y + (last.y - first.y)/2, rx, ry, 0, 0, Math.PI * 2);
        }
      } else {
        for (let i = 1; i < s.points.length; i++) c.lineTo(s.points[i]!.x, s.points[i]!.y);
      }
      
      c.stroke();
      c.globalAlpha = 1;
    }

    // --- DRAW NOTES ---
    for (const n of Object.values(this.state.notes)) {
      c.fillStyle = '#ffeb3b';
      c.shadowColor = 'rgba(0,0,0,0.15)';
      c.shadowBlur = 10;
      c.shadowOffsetX = 2;
      c.shadowOffsetY = 2;
      c.fillRect(n.x, n.y, n.w, n.h);
      
      c.shadowColor = 'transparent';
      c.fillStyle = '#111';
      c.font = '16px "Comic Sans MS", cursive, sans-serif';
      
      const words = n.text.split(' ');
      let line = '';
      let y = n.y + 25;
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = c.measureText(testLine);
        if (metrics.width > n.w - 20 && i > 0) {
          c.fillText(line, n.x + 10, y);
          line = words[i] + ' ';
          y += 20;
        } else {
          line = testLine;
        }
      }
      c.fillText(line, n.x + 10, y);
    }
    
    c.restore();
  }
}