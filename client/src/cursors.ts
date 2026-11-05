export class Cursors {
  private container: HTMLElement;
  private active = new Map<string, { el: HTMLElement, timer: number }>();

  constructor() {
    this.container = document.getElementById('cursors')!;
  }

  private getColor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
  }

  update(id: string, x: number, y: number) {
    let entry = this.active.get(id);

    if (!entry) {
      const el = document.createElement('div');
      el.className = 'remote-cursor';
      const color = this.getColor(id);
      el.style.backgroundColor = color;
      
      const label = document.createElement('div');
      label.className = 'remote-cursor-label';
      label.style.backgroundColor = color;
      label.textContent = `User ${id}`;
      
      el.appendChild(label);
      this.container.appendChild(el);
      
      entry = { el, timer: 0 };
      this.active.set(id, entry);
    }

    entry.el.style.left = `${x}px`;
    entry.el.style.top = `${y}px`;

    clearTimeout(entry.timer);
    entry.timer = window.setTimeout(() => {
      entry.el.remove();
      this.active.delete(id);
    }, 5000);
  }
}