# Collaborative Whiteboard & Note-Taking App

A real-time, multiplayer canvas application featuring an infinite whiteboard, paginated notebooks, and PDF annotation. Built with Node.js, WebSockets, TypeScript, and a custom Canvas rendering engine.

## 🚀 Features
- **Real-time Collaboration:** Multiple users can draw, type, and pan simultaneously with live cursor tracking.
- **Server-Authoritative Sync:** Custom Operation (Op) log architecture. The server maintains the "truth" and resolves conflicts.
- **Multiple Board Modes:**
  - *Infinite Canvas:* Pan and zoom infinitely (like Miro/Figma).
  - *Notebook:* Fixed, paginated A4 sheets.
  - *PDF Annotation:* Upload and draw over PDF documents.
- **Advanced Tools:** Pen, shapes, eraser, sticky notes, laser pointer, and a color-picker (eyedropper).
- **SaaS Architecture (Mocked):** Includes a pricing page, server-side coupon validation, and feature gating (Pro vs. Free limits).

## 🛠 Tech Stack
- **Frontend:** Vanilla TypeScript, HTML5 Canvas API, Vite, IndexedDB (for local state).
- **Backend:** Node.js, `ws` (WebSockets), SQLite (for persistence).
- **State Management:** Event-driven architecture using an append-only Op Log. All clients replay operations to reach a consistent state.

## 🧠 Architecture Highlights
- **No React/Vue:** Built entirely with the native DOM and Canvas API to demonstrate raw rendering performance and memory management.
- **Conflict Resolution:** Uses Last-Writer-Wins (LWW) for notes and append-only arrays for brush strokes, ensuring no two users can "break" the canvas.
- **Offline-ready (Mocked):** Uses LocalStorage and sessionStorage to persist recent files and user "Pro" status.

## 🏃‍♂️ How to Run Locally
1. Clone the repository.
2. Install dependencies: `npm install`
3. Start the backend server: `npm run dev:server`
4. Start the frontend: `npm run dev:client`
5. Open `http://localhost:5173` in two browser windows side-by-side to test real-time sync.