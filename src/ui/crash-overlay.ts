const REENTRY_ALTITUDE = 70e3; // 70 km in meters
const COUNTDOWN_SECONDS = 60;

export class CrashOverlay {
  private overlay: HTMLDivElement;
  private countdownEl: HTMLSpanElement;
  private timer: number | null = null;
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
      <div style="color: #ff2222; font-size: 64px; font-weight: bold; text-shadow: 0 0 20px #ff0000;">
        YOU CRASHED
      </div>
      <div style="color: #ff8888; font-size: 20px; margin-top: 16px;">
        Spacecraft destroyed during atmospheric reentry
      </div>
      <div style="color: #888; font-size: 16px; margin-top: 32px;">
        Click anywhere to restart — auto-restart in <span id="crash-countdown">${COUNTDOWN_SECONDS}</span>s
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.countdownEl = this.overlay.querySelector('#crash-countdown')!;

    this.overlay.addEventListener('click', () => this.restart());
  }

  setRestartCallback(cb: () => void) {
    this.onRestart = cb;
  }

  checkCrash(altitudeMeters: number): boolean {
    return altitudeMeters < REENTRY_ALTITUDE;
  }

  show() {
    this.overlay.style.display = 'flex';
    let remaining = COUNTDOWN_SECONDS;
    this.countdownEl.textContent = String(remaining);

    this.timer = window.setInterval(() => {
      remaining--;
      this.countdownEl.textContent = String(remaining);
      if (remaining <= 0) {
        this.restart();
      }
    }, 1000);
  }

  hide() {
    this.overlay.style.display = 'none';
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private restart() {
    this.hide();
    this.onRestart?.();
  }
}
