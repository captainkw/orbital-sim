const BLOCKED_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'Space', 'Comma', 'Period', 'KeyT',
]);

export class InputManager {
  private keys = new Map<string, boolean>();
  private syntheticKeys = new Map<string, boolean>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (BLOCKED_KEYS.has(e.code)) {
        e.preventDefault();
      }
      this.keys.set(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });
  }

  setSyntheticKey(code: string, state: boolean): void {
    this.syntheticKeys.set(code, state);
  }

  isDown(code: string): boolean {
    return this.keys.get(code) === true || this.syntheticKeys.get(code) === true;
  }

  /** Consume a key press (returns true once, then false until re-pressed) */
  consume(code: string): boolean {
    if (this.keys.get(code)) {
      this.keys.set(code, false);
      return true;
    }
    return false;
  }
}
