export class DockingOverlay {
  private overlay: HTMLDivElement;
  private onContinue: (() => void) | null = null;
  private onUndock: (() => void) | null = null;
  private undockBtn: HTMLButtonElement;

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
        Click anywhere to continue flying
      </div>
    `;

    this.undockBtn = document.createElement('button');
    this.undockBtn.textContent = 'Undock from ISS';
    Object.assign(this.undockBtn.style, {
      display: 'none',
      position: 'fixed',
      bottom: '72px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 20px',
      background: 'rgba(0,0,0,0.7)',
      color: '#ff8844',
      border: '1px solid #ff8844',
      borderRadius: '4px',
      fontFamily: "'Courier New', monospace",
      fontSize: '13px',
      cursor: 'pointer',
      zIndex: '1000',
    });
    document.body.appendChild(this.undockBtn);

    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', () => this.continue());
    this.undockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onUndock?.();
    });
  }

  setContinueCallback(cb: () => void) {
    this.onContinue = cb;
  }

  setUndockCallback(cb: () => void) {
    this.onUndock = cb;
  }

  /** @deprecated use setContinueCallback */
  setRestartCallback(cb: () => void) {
    this.setContinueCallback(cb);
  }

  show() {
    this.overlay.style.display = 'flex';
  }

  hide() {
    this.overlay.style.display = 'none';
  }

  showUndockButton() {
    this.undockBtn.style.display = 'block';
  }

  hideUndockButton() {
    this.undockBtn.style.display = 'none';
  }

  private continue() {
    this.hide();
    this.onContinue?.();
  }
}
