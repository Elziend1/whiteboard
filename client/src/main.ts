import { Canvas } from './canvas';
import { Socket } from './socket';
import { Cursors } from './cursors';
import type { S2C, ToolType, ShapeType, BackgroundType } from '../../protocol/src/index';

const myId = crypto.randomUUID().slice(0, 8);
const urlParams = new URLSearchParams(location.search);
const room = urlParams.get('room') || `demo_${Date.now()}`;
const boardType = urlParams.get('type') || 'infinite';

const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';

const canvas = new Canvas(document.getElementById('board') as HTMLCanvasElement, myId, boardType);
const socket = new Socket(`${wsProto}://${location.host}/ws`, room, myId);
const cursors = new Cursors();

// --- CHECK PRO STATUS ---
const isPro = localStorage.getItem('isPro') === 'true';
canvas.isPro = isPro;

if (isPro) {
  document.querySelectorAll('.pro-locked').forEach(el => {
    el.classList.remove('pro-locked');
    const lock = el.querySelector('.lock');
    if (lock) lock.remove();
  });
  const upgradeLink = document.querySelector('.upgrade-link');
  if (upgradeLink) upgradeLink.remove();
}

// --- AUTO-SAVE LOGIC ---
function saveToRecent() {
  const files = JSON.parse(localStorage.getItem('recent_files') || '[]');
  const existing = files.findIndex((f: any) => f.id === room);
  
  const fileData = {
    id: room,
    type: boardType,
    name: `${boardType === 'notebook' ? 'Notebook' : 'Infinite Canvas'} (${new Date().toLocaleDateString()})`,
    updatedAt: Date.now()
  };

  if (existing >= 0) files[existing] = fileData;
  else files.push(fileData);
  
  localStorage.setItem('recent_files', JSON.stringify(files));
}

saveToRecent();
canvas.onOp((op) => { socket.send({ type: 'op', op }); saveToRecent(); });

// --- UI SETUP ---
const settingsBtn = document.getElementById('settings-btn')!;
const settingsPanel = document.getElementById('settings-panel')!;
const toolbar = document.getElementById('floating-toolbar')!;
const dragHandle = document.getElementById('drag-handle')!;
const themeToggle = document.getElementById('theme-toggle');
const setToolbarLock = document.getElementById('set-toolbar-lock') as HTMLInputElement;
const setPaper = document.getElementById('set-paper') as HTMLSelectElement;

const pageControls = document.getElementById('page-controls')!;
const handBtn = document.getElementById('hand-btn')!;

if (canvas.boardType === 'notebook') {
  pageControls.classList.remove('hidden');
  handBtn.classList.add('hidden');
  document.getElementById('board')!.style.cursor = 'default';
} else {
  pageControls.classList.add('hidden');
}

document.getElementById('next-page')!.addEventListener('click', () => canvas.nextPage());
document.getElementById('prev-page')!.addEventListener('click', () => canvas.prevPage());

// Undo / Redo
document.getElementById('undo-btn')!.addEventListener('click', () => canvas.undo());
document.getElementById('redo-btn')!.addEventListener('click', () => canvas.redo());

settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
setPaper.addEventListener('change', () => canvas.setBackground(setPaper.value as BackgroundType));

function applyTheme(isDark: boolean) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if(themeToggle) themeToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
if (localStorage.getItem('theme') === 'dark') applyTheme(true);
themeToggle?.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark'));

// --- DRAGGABLE TOOLBAR ---
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let toolbarPos = { left: 0, top: 0 };

const rect = toolbar.getBoundingClientRect();
toolbarPos = { left: rect.left, top: rect.top };
toolbar.style.left = `${toolbarPos.left}px`;
toolbar.style.top = `${toolbarPos.top}px`;
toolbar.style.bottom = 'auto';
toolbar.style.transform = 'none';

dragHandle.addEventListener('pointerdown', (e) => {
  if (setToolbarLock.checked) return;
  isDragging = true;
  dragStart = { x: e.clientX - toolbarPos.left, y: e.clientY - toolbarPos.top };
  dragHandle.setPointerCapture(e.pointerId);
});

dragHandle.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  toolbarPos = { left: e.clientX - dragStart.x, top: e.clientY - dragStart.y };
  toolbar.style.left = `${toolbarPos.left}px`;
  toolbar.style.top = `${toolbarPos.top}px`;
});

dragHandle.addEventListener('pointerup', (e) => {
  isDragging = false;
  dragHandle.releasePointerCapture(e.pointerId);
});

// --- TOOLBAR BUTTONS ---
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const el = e.currentTarget as HTMLElement;
    const tool = el.getAttribute('data-tool') as ToolType;
    const shape = el.getAttribute('data-shape') as ShapeType | undefined;
    
    if (el.classList.contains('pro-locked') && !canvas.isPro) {
      alert(`🔒 Pro feature. Upgrade to unlock!`);
      return;
    }

    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    canvas.setTool(tool, shape);
    
    if (tool === 'hand') document.getElementById('board')!.style.cursor = 'grab';
    else document.getElementById('board')!.style.cursor = 'crosshair';
  });
});

// --- PREMIUM COLOR POPOVER ---
const premiumBtn = document.getElementById('premium-colors-btn')!;
const premiumPalette = document.getElementById('premium-palette')!;
const premiumColors = ['#ff0055', '#00f0ff', '#ffaa00', '#9d00ff', '#00ff88'];

premiumColors.forEach(color => {
  const swatch = document.createElement('div');
  swatch.className = 'premium-swatch';
  swatch.style.background = color;
  swatch.addEventListener('click', () => {
    if (!canvas.isPro) return alert("🔒 Premium colors are a Pro feature.");
    canvas.setColor(color);
    premiumPalette.classList.add('hidden');
  });
  premiumPalette.appendChild(swatch);
});

premiumBtn.addEventListener('click', () => {
  if (!canvas.isPro) return alert("🔒 Upgrade to Pro to access the special color palette!");
  premiumPalette.classList.toggle('hidden');
});

// --- EYEDROPPER LOGIC ---
const eyedropperBtn = document.getElementById('eyedropper-btn')!;
const eyedropperCount = document.getElementById('eyedropper-count')!;
let picksLeft = parseInt(localStorage.getItem('picksLeft') || '10');
eyedropperCount.textContent = picksLeft.toString();

eyedropperBtn.addEventListener('click', () => {
  if (!canvas.isPro && picksLeft <= 0) return alert("🔒 10 free picks used. Upgrade for unlimited!");
  eyedropperBtn.textContent = '🎯';
  const clickHandler = (e: MouseEvent) => {
    const color = canvas.pickColor(e.clientX, e.clientY);
    if (color) {
      canvas.setColor(color);
      if (!canvas.isPro) {
        picksLeft--;
        localStorage.setItem('picksLeft', picksLeft.toString());
        eyedropperCount.textContent = picksLeft.toString();
      }
    }
    eyedropperBtn.innerHTML = `💧<span id="eyedropper-count">${picksLeft}</span>`;
    window.removeEventListener('click', clickHandler);
  };
  setTimeout(() => window.addEventListener('click', clickHandler, { once: true }), 100);
});

// --- LIVE CURSORS ---
let lastSend = 0;
window.addEventListener('pointermove', (e) => {
  const now = Date.now();
  if (now - lastSend > 40) {
    lastSend = now;
    const rect = canvas.getRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      socket.send({ type: 'cursor', x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }
});

socket.onMessage((m: S2C) => {
  if (m.type === 'snapshot') {
    canvas.applySnapshot(m.state);
    // Load PDF if the URL has one (this is a quick hack for the PDF flow)
    const urlParams = new URLSearchParams(location.search);
    const pdfName = urlParams.get('pdf');
    if (pdfName && m.seq === 0) {
       // In a real app, we would download the PDF from the server here.
       // For this demo, we just show an alert.
       console.log("PDF Room detected:", pdfName);
    }
  }
  if (m.type === 'op' && m.clientId !== myId) canvas.applyRemote(m.op);
  if (m.type === 'cursor' && m.clientId !== myId) cursors.update(m.clientId, m.x, m.y);
});