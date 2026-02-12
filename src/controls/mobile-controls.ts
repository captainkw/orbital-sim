import { InputManager } from './input-manager';
import { VirtualJoystick } from './virtual-joystick';

export class MobileControls {
  private leftJoystick: VirtualJoystick | null = null;
  private rightJoystick: VirtualJoystick | null = null;

  readonly isMobile: boolean;

  constructor(inputManager: InputManager) {
    this.isMobile = 'ontouchstart' in window;
    if (!this.isMobile) return;

    // Left joystick: WASD thrust
    this.leftJoystick = new VirtualJoystick(inputManager, 'left', {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
    }, 'Manual Thrust Control');

    // Right joystick: arrow key rotation
    this.rightJoystick = new VirtualJoystick(inputManager, 'right', {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    }, 'Manual Pitch / Yaw');

    document.body.appendChild(this.leftJoystick.element);
    document.body.appendChild(this.rightJoystick.element);

    // Hide desktop controls help
    const help = document.getElementById('controls-help');
    if (help) help.style.display = 'none';
  }

  dispose() {
    this.leftJoystick?.dispose();
    this.rightJoystick?.dispose();
  }
}
