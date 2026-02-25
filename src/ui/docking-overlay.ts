export class DockingOverlay {
  private overlay: HTMLDivElement;
  private onRestart: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999',
      cursor: 'pointer',
      fontFamily: "'Courier New', monospace",
    });

    this.overlay.innerHTML = `
      <div style="color: #00ff88; font-size: 64px; font-weight: bold; text-shadow: 0 0 20px #00ff88;">
        DOCKED
      </div>
      <div style="color: #88ffcc; font-size: 20px; margin-top: 16px;">
        Successfully docked with the International Space Station
      </div>
      <div style="color: #aaaaaa; font-size: 14px; margin-top: 24px; max-width: 480px; text-align: center; line-height: 1.7;">
        Phase orbit at 350 km → TI Burn → Transfer ellipse → Circularization at 408 km
      </div>
      <div style="color: #555; font-size: 13px; margin-top: 32px;">
        Click anywhere to restart
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', () => this.restart());
  }

  setRestartCallback(cb: () => void) {
    this.onRestart = cb;
  }

  show() {
    this.overlay.style.display = 'flex';
  }

  hide() {
    this.overlay.style.display = 'none';
  }

  private restart() {
    this.hide();
    this.onRestart?.();
  }
}
