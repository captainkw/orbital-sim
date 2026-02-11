import { InputManager } from '../controls/input-manager';
import { WarpLevel, WARP_LEVELS } from '../types';

export class TimeControls {
  private warpIndex = 0;
  paused = false;

  get warpLevel(): WarpLevel {
    return WARP_LEVELS[this.warpIndex];
  }

  private warpIndicator: HTMLElement;

  constructor(private input: InputManager) {
    this.warpIndicator = document.getElementById('warp-indicator')!;
  }

  update() {
    if (this.input.consume('Space')) {
      this.paused = !this.paused;
    }

    if (this.input.consume('Period')) {
      if (this.warpIndex < WARP_LEVELS.length - 1) {
        this.warpIndex++;
      }
    }

    if (this.input.consume('Comma')) {
      if (this.warpIndex > 0) {
        this.warpIndex--;
      }
    }

    // Update warp indicator
    if (this.warpLevel > 1 || this.paused) {
      this.warpIndicator.textContent = this.paused
        ? '⏸ PAUSED'
        : `▶▶ ${this.warpLevel}x`;
    } else {
      this.warpIndicator.textContent = '';
    }
  }
}
