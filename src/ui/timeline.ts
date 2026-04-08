import { ManeuverSequence } from '../types';
import { MissionPhase } from '../artemis/mission-phases';

export class Timeline {
  private container: HTMLElement;
  private bar: HTMLElement;
  private playhead: HTMLElement;
  private totalDuration = 0;

  // Artemis scrubbing
  private onSeek: ((timeMs: number) => void) | null = null;
  private artemisEpochStartMs = 0;
  private artemisEpochEndMs = 0;
  private scrubbing = false;

  constructor() {
    this.container = document.getElementById('timeline-container')!;
    this.bar = document.getElementById('timeline-bar')!;
    this.playhead = document.getElementById('timeline-playhead')!;
  }

  loadSequence(sequence: ManeuverSequence) {
    // Clear existing blocks
    this.bar.querySelectorAll('.maneuver-block,.phase-block').forEach(el => el.remove());
    this.bar.classList.remove('artemis-scrub');
    this.removeScrubListeners();

    this.totalDuration = sequence.totalDuration;
    if (this.totalDuration <= 0) return;

    for (const m of sequence.maneuvers) {
      const block = document.createElement('div');
      block.className = 'maneuver-block';
      const startPct = (m.startTime / this.totalDuration) * 100;
      const widthPct = Math.max((m.duration / this.totalDuration) * 100, 0.5);
      block.style.left = `${startPct}%`;
      block.style.width = `${widthPct}%`;

      const dvMag = Math.sqrt(m.deltaV[0] ** 2 + m.deltaV[1] ** 2 + m.deltaV[2] ** 2);
      block.title = `${m.id}: ΔV=${dvMag.toFixed(1)} m/s @ T+${m.startTime}s`;

      // Label above the block
      const label = document.createElement('div');
      label.className = 'maneuver-label';
      label.textContent = m.id;
      block.appendChild(label);

      this.bar.appendChild(block);
    }
  }

  /**
   * Load Artemis mission phases as colored blocks on the timeline.
   * Enables scrubbing (click/drag to seek).
   */
  loadArtemisPhases(
    phases: MissionPhase[],
    epochStartMs: number,
    epochEndMs: number,
    onSeek: (timeMs: number) => void,
  ) {
    // Clear existing blocks
    this.bar.querySelectorAll('.maneuver-block,.phase-block').forEach(el => el.remove());

    this.artemisEpochStartMs = epochStartMs;
    this.artemisEpochEndMs = epochEndMs;
    this.onSeek = onSeek;
    const totalMs = epochEndMs - epochStartMs;
    if (totalMs <= 0) return;

    for (const phase of phases) {
      const block = document.createElement('div');
      block.className = 'phase-block';
      const startPct = ((phase.startTimeMs - epochStartMs) / totalMs) * 100;
      const widthPct = ((phase.endTimeMs - phase.startTimeMs) / totalMs) * 100;
      block.style.left = `${startPct}%`;
      block.style.width = `${widthPct}%`;
      block.style.background = phase.color;
      block.title = phase.label;

      // Phase label inside the block
      const label = document.createElement('div');
      label.className = 'phase-label';
      label.textContent = phase.shortLabel;
      block.appendChild(label);

      this.bar.appendChild(block);
    }

    // Enable scrubbing
    this.bar.classList.add('artemis-scrub');
    this.attachScrubListeners();
  }

  updatePlayhead(simTime: number) {
    if (this.totalDuration <= 0) {
      this.playhead.style.left = '0%';
      return;
    }
    const pct = Math.min((simTime / this.totalDuration) * 100, 100);
    this.playhead.style.left = `${pct}%`;
  }

  /** Position playhead by fractional progress [0, 1]. Used in Artemis mode. */
  updateFromProgress(progress: number) {
    const pct = Math.max(0, Math.min(100, progress * 100));
    this.playhead.style.left = `${pct}%`;
  }

  // --- Scrubbing ---

  private handlePointerDown = (e: PointerEvent) => {
    this.scrubbing = true;
    this.bar.setPointerCapture(e.pointerId);
    this.seekFromPointer(e);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.scrubbing) return;
    this.seekFromPointer(e);
  };

  private handlePointerUp = () => {
    this.scrubbing = false;
  };

  private seekFromPointer(e: PointerEvent) {
    if (!this.onSeek) return;
    const rect = this.bar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const totalMs = this.artemisEpochEndMs - this.artemisEpochStartMs;
    const timeMs = this.artemisEpochStartMs + fraction * totalMs;
    this.onSeek(timeMs);
  }

  private attachScrubListeners() {
    this.bar.addEventListener('pointerdown', this.handlePointerDown);
    this.bar.addEventListener('pointermove', this.handlePointerMove);
    this.bar.addEventListener('pointerup', this.handlePointerUp);
    this.bar.addEventListener('pointercancel', this.handlePointerUp);
  }

  private removeScrubListeners() {
    this.bar.removeEventListener('pointerdown', this.handlePointerDown);
    this.bar.removeEventListener('pointermove', this.handlePointerMove);
    this.bar.removeEventListener('pointerup', this.handlePointerUp);
    this.bar.removeEventListener('pointercancel', this.handlePointerUp);
    this.scrubbing = false;
    this.onSeek = null;
  }
}
