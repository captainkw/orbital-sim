import { ManeuverSequence } from '../types';

export class Timeline {
  private container: HTMLElement;
  private bar: HTMLElement;
  private playhead: HTMLElement;
  private totalDuration = 0;

  constructor() {
    this.container = document.getElementById('timeline-container')!;
    this.bar = document.getElementById('timeline-bar')!;
    this.playhead = document.getElementById('timeline-playhead')!;
  }

  loadSequence(sequence: ManeuverSequence) {
    // Clear existing maneuver blocks
    this.bar.querySelectorAll('.maneuver-block').forEach(el => el.remove());

    this.totalDuration = sequence.totalDuration;
    if (this.totalDuration <= 0) return;

    for (const m of sequence.maneuvers) {
      const block = document.createElement('div');
      block.className = 'maneuver-block';
      const startPct = (m.startTime / this.totalDuration) * 100;
      const widthPct = Math.max((m.duration / this.totalDuration) * 100, 0.5);
      block.style.left = `${startPct}%`;
      block.style.width = `${widthPct}%`;
      block.title = `${m.id}: dV=[${m.deltaV.map(v => v.toFixed(1)).join(', ')}] m/s @ T+${m.startTime}s`;
      this.bar.appendChild(block);
    }
  }

  updatePlayhead(simTime: number) {
    if (this.totalDuration <= 0) {
      this.playhead.style.left = '0%';
      return;
    }
    const pct = Math.min((simTime / this.totalDuration) * 100, 100);
    this.playhead.style.left = `${pct}%`;
  }
}
