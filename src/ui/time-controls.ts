import { InputManager } from '../controls/input-manager';
import { WarpLevel, WARP_LEVELS } from '../types';

export class TimeControls {
  private warpIndex = Math.max(0, WARP_LEVELS.indexOf(100)); // Default to 100x
  paused = false;

  get warpLevel(): WarpLevel {
    return WARP_LEVELS[this.warpIndex];
  }

  private warpIndicator: HTMLElement;
  private warpSlider: HTMLInputElement;

  constructor(private input: InputManager) {
    this.warpIndicator = document.getElementById('warp-indicator')!;
    this.warpSlider = document.getElementById('warp-slider') as HTMLInputElement;
    this.warpSlider.min = '0';
    this.warpSlider.max = String(WARP_LEVELS.length - 1);
    this.warpSlider.step = '1';
    this.warpSlider.value = String(this.warpIndex);

    // Slider → warp index
    this.warpSlider.addEventListener('input', () => {
      this.warpIndex = Number(this.warpSlider.value);
    });
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

    // Sync slider to current index (covers keyboard changes)
    this.warpSlider.value = String(this.warpIndex);

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
