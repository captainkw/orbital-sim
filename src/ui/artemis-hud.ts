import { SCALE } from '../constants';

/**
 * AROW-style bottom telemetry gauges for Artemis II mission mode.
 * Displays: Mission Elapsed Time, Velocity, Altitude, Distance to Moon.
 * Uses circular gauge styling inspired by NASA's AROW interface.
 */
export class ArtemisHUD {
  private container: HTMLElement;
  private metEl: HTMLElement;
  private velEl: HTMLElement;
  private altEl: HTMLElement;
  private moonDistEl: HTMLElement;
  private statusEl: HTMLElement;
  private phaseLabelEl: HTMLElement;
  private controlsEl: HTMLElement;
  private modeIndicatorEl: HTMLElement;
  private visible = false;

  constructor() {
    this.container = document.getElementById('artemis-hud')!;
    this.metEl = document.getElementById('gauge-met-value')!;
    this.velEl = document.getElementById('gauge-vel-value')!;
    this.altEl = document.getElementById('gauge-alt-value')!;
    this.moonDistEl = document.getElementById('gauge-moon-value')!;
    this.statusEl = document.getElementById('telemetry-status')!;
    this.phaseLabelEl = document.getElementById('artemis-phase-label')!;
    this.controlsEl = document.getElementById('artemis-controls')!;
    this.modeIndicatorEl = document.getElementById('artemis-mode-indicator')!;
  }

  show() {
    this.visible = true;
    this.container.style.display = 'flex';
    this.phaseLabelEl.style.display = 'block';
    this.controlsEl.style.display = 'flex';
  }

  hide() {
    this.visible = false;
    this.container.style.display = 'none';
    this.phaseLabelEl.style.display = 'none';
    this.controlsEl.style.display = 'none';
  }

  isVisible(): boolean {
    return this.visible;
  }

  setTelemetryStatus(status: 'LIVE' | 'OFFLINE' | 'NO DATA') {
    this.statusEl.textContent = status;
    this.statusEl.className = 'telemetry-status';
    if (status === 'LIVE') {
      this.statusEl.classList.add('status-live');
    } else if (status === 'NO DATA') {
      this.statusEl.classList.add('status-nodata');
    } else {
      this.statusEl.classList.add('status-offline');
    }
  }

  update(
    missionElapsedSeconds: number,
    velocityMs: number,
    altitudeMeters: number,
    moonDistanceMeters: number
  ) {
    if (!this.visible) return;

    // Mission Elapsed Time — DDd HH:MM
    const totalMin = Math.floor(Math.abs(missionElapsedSeconds) / 60);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    const secs = Math.floor(Math.abs(missionElapsedSeconds) % 60);
    this.metEl.textContent =
      `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Velocity — km/s
    const velKmS = velocityMs / 1000;
    this.velEl.textContent = velKmS < 10
      ? velKmS.toFixed(2)
      : velKmS.toFixed(1);

    // Altitude — km
    const altKm = altitudeMeters / 1000;
    this.altEl.textContent = altKm < 1000
      ? Math.round(altKm).toLocaleString()
      : Math.round(altKm).toLocaleString();

    // Distance to Moon — km
    const moonKm = moonDistanceMeters / 1000;
    this.moonDistEl.textContent = Math.round(moonKm).toLocaleString();
  }

  setPhaseLabel(label: string) {
    this.phaseLabelEl.textContent = label;
  }

  setModeIndicator(mode: 'realtime' | 'simulation', warp: number) {
    const toggleBtn = document.getElementById('btn-artemis-mode-toggle')!;
    if (mode === 'realtime') {
      toggleBtn.textContent = 'LIVE';
      toggleBtn.classList.remove('sim-mode');
      this.modeIndicatorEl.textContent = '';
      this.modeIndicatorEl.classList.remove('sim-mode');
    } else {
      toggleBtn.textContent = 'SIM';
      toggleBtn.classList.add('sim-mode');
      this.modeIndicatorEl.classList.add('sim-mode');
      if (warp > 1) {
        this.modeIndicatorEl.textContent = `${warp}x`;
      } else {
        this.modeIndicatorEl.textContent = '1x';
      }
    }
  }
}
