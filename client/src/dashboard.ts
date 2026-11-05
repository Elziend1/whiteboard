const themeToggle = document.getElementById('theme-toggle');
function applyTheme(isDark: boolean) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if(themeToggle) themeToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
if (localStorage.getItem('theme') === 'dark') applyTheme(true);
themeToggle?.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
});

// --- NAVIGATION ---
const pdfInput = document.getElementById('pdf-input') as HTMLInputElement;

document.getElementById('btn-infinite')?.addEventListener('click', () => {
  const id = `inf_${Date.now()}`;
  window.location.href = `/board.html?type=infinite&room=${id}`;
});

document.getElementById('btn-notebook')?.addEventListener('click', () => {
  const id = `note_${Date.now()}`;
  window.location.href = `/board.html?type=notebook&room=${id}`;
});

document.getElementById('btn-pdf')?.addEventListener('click', () => {
  alert("Note: PDF annotation is a Pro feature. You are viewing a demo.");
  pdfInput.click();
});

pdfInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    // 1. Read the file into memory
    const arrayBuffer = await file.arrayBuffer();
    
    // 2. Open a new board
    const id = `pdf_${Date.now()}`;
    const url = `/board.html?type=infinite&room=${id}`;
    window.location.href = url;

    // 3. We have to pass the file data to the new page. 
    // Since we can't pass an ArrayBuffer through the URL, we store it in sessionStorage.
    // (In a real app, we'd upload it to a server first).
    sessionStorage.setItem('temp_pdf', JSON.stringify(Array.from(new Uint8Array(arrayBuffer))));
  }
});

// --- RECENT FILES ---
const recentList = document.getElementById('recent-list')!;
const files = JSON.parse(localStorage.getItem('recent_files') || '[]');

if (files.length === 0) {
  recentList.innerHTML = `<p style="color: #888;">No recent files yet. Create one above!</p>`;
} else {
  files.sort((a: any, b: any) => b.updatedAt - a.updatedAt).forEach((file: any) => {
    const el = document.createElement('a');
    el.href = `/board.html?type=${file.type}&room=${file.id}`;
    el.className = 'glass-panel';
    el.style.flexDirection = 'row';
    el.style.alignItems = 'center';
    el.style.padding = '16px';
    el.style.textDecoration = 'none';
    el.style.color = 'var(--text)';
    el.style.width = '100%';
    
    const date = new Date(file.updatedAt).toLocaleString();
    el.innerHTML = `
      <div style="font-size: 1.5rem; margin-right: 16px;">
        ${file.type === 'notebook' ? '📓' : file.type === 'pdf' ? '📄' : '♾️'}
      </div>
      <div style="flex: 1;">
        <div style="font-weight: bold; font-size: 1.1rem;">${file.name}</div>
        <div style="color: #888; font-size: 0.85rem;">Last opened: ${date}</div>
      </div>
      <div style="font-weight: bold; color: var(--active);">Open →</div>
    `;
    recentList.appendChild(el);
  });
}