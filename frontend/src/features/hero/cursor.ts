import { CursorState } from './types';

export class CustomCursor {
  private readonly cursor: HTMLElement;
  private readonly dot: HTMLElement;
  private readonly ring: HTMLElement;
  private readonly glow: HTMLElement;
  private readonly pos: { x: number; y: number };
  private readonly target: { x: number; y: number };
  private state: CursorState;
  private rafId: number;

  constructor() {
    this.cursor = document.getElementById('cursor')!;
    this.dot = this.cursor.querySelector('.lh-cursor-dot')!;
    this.ring = this.cursor.querySelector('.lh-cursor-ring')!;
    this.glow = this.cursor.querySelector('.lh-cursor-glow')!;

    this.pos = { x: -100, y: -100 };
    this.target = { x: -100, y: -100 };
    this.state = 'default';
    this.rafId = 0;

    this.bindEvents();
    this.loop();
  }

  private bindEvents(): void {
    document.addEventListener('mousemove', (e: MouseEvent) => {
      this.target.x = e.clientX;
      this.target.y = e.clientY;
    });

    const interactiveSelectors = 'a, button, .lh-nav-link, .lh-btn';

    document.addEventListener('mouseover', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches(interactiveSelectors) || target.closest(interactiveSelectors)) {
        this.setState('hover');
      }
    });

    document.addEventListener('mouseout', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches(interactiveSelectors) || target.closest(interactiveSelectors)) {
        this.setState('default');
      }
    });
  }

  setState(state: CursorState): void {
    this.state = state;
    this.cursor.classList.remove('hover', 'active');
    if (state !== 'default') {
      this.cursor.classList.add(state);
    }
  }

  setActive(active: boolean): void {
    if (active && this.state !== 'active') {
      this.setState('active');
    } else if (!active && this.state === 'active') {
      this.setState('default');
    }
  }

  private loop = (): void => {
    this.pos.x += (this.target.x - this.pos.x) * 0.15;
    this.pos.y += (this.target.y - this.pos.y) * 0.15;
    this.cursor.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px) translate(-50%, -50%)`;
    this.rafId = requestAnimationFrame(this.loop);
  };

  destroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}