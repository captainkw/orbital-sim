import { InputManager } from './input-manager';

export interface JoystickKeyMapping {
  up: string;
  down: string;
  left: string;
  right: string;
}

export class VirtualJoystick {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private inputManager: InputManager;
  private keys: JoystickKeyMapping;

  private readonly size = 140;
  private readonly baseRadius = 55;
  private readonly knobRadius = 22;
  private readonly deadzone = 0.2;

  private knobX = 0;
  private knobY = 0;
  private activeTouch: number | null = null;

  constructor(inputManager: InputManager, side: 'left' | 'right', keys: JoystickKeyMapping) {
    this.inputManager = inputManager;
    this.keys = keys;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.style.cssText = `
      position: absolute;
      bottom: 60px;
      ${side}: 10px;
      width: ${this.size}px;
      height: ${this.size}px;
      touch-action: none;
      z-index: 1000;
      pointer-events: auto;
    `;

    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });

    this.draw();
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (this.activeTouch !== null) return;
    const touch = e.changedTouches[0];
    this.activeTouch = touch.identifier;
    this.updateKnob(touch);
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.activeTouch) {
        this.updateKnob(touch);
        break;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.activeTouch) {
        this.activeTouch = null;
        this.knobX = 0;
        this.knobY = 0;
        this.clearKeys();
        this.draw();
        break;
      }
    }
  };

  private updateKnob(touch: Touch) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;

    // Clamp to base radius
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.baseRadius) {
      dx = (dx / dist) * this.baseRadius;
      dy = (dy / dist) * this.baseRadius;
    }

    this.knobX = dx / this.baseRadius; // -1 to 1
    this.knobY = dy / this.baseRadius;

    this.updateKeys();
    this.draw();
  }

  private updateKeys() {
    const mag = Math.sqrt(this.knobX * this.knobX + this.knobY * this.knobY);
    if (mag < this.deadzone) {
      this.clearKeys();
      return;
    }

    this.inputManager.setSyntheticKey(this.keys.up, this.knobY < -this.deadzone);
    this.inputManager.setSyntheticKey(this.keys.down, this.knobY > this.deadzone);
    this.inputManager.setSyntheticKey(this.keys.left, this.knobX < -this.deadzone);
    this.inputManager.setSyntheticKey(this.keys.right, this.knobX > this.deadzone);
  }

  private clearKeys() {
    this.inputManager.setSyntheticKey(this.keys.up, false);
    this.inputManager.setSyntheticKey(this.keys.down, false);
    this.inputManager.setSyntheticKey(this.keys.left, false);
    this.inputManager.setSyntheticKey(this.keys.right, false);
  }

  private draw() {
    const ctx = this.ctx;
    const half = this.size / 2;

    ctx.clearRect(0, 0, this.size, this.size);

    // Outer ring
    ctx.beginPath();
    ctx.arc(half, half, this.baseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner knob
    const kx = half + this.knobX * this.baseRadius;
    const ky = half + this.knobY * this.baseRadius;
    ctx.beginPath();
    ctx.arc(kx, ky, this.knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.activeTouch !== null
      ? 'rgba(0, 255, 136, 0.7)'
      : 'rgba(0, 255, 136, 0.4)';
    ctx.fill();
  }

  dispose() {
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
    this.canvas.remove();
    this.clearKeys();
  }
}
