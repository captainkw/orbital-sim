import * as THREE from 'three';
import { InputManager } from './input-manager';
import { ROTATION_RATE, THRUST_ACCEL } from '../constants';
import { SpacecraftState } from '../types';

const _q = new THREE.Quaternion();
const _euler = new THREE.Euler();

export class SpacecraftControls {
  private input: InputManager;

  constructor(input: InputManager) {
    this.input = input;
  }

  /**
   * Apply keyboard inputs to spacecraft state.
   * @param state Current spacecraft state (mutated in place)
   * @param dt Real delta time for rotation (seconds)
   * @returns Thrust acceleration vector in ECI frame (m/s^2), or [0,0,0]
   */
  update(state: SpacecraftState, dt: number): [number, number, number] {
    // --- Rotation (Arrow Keys) ---
    const quat = new THREE.Quaternion(
      state.quaternion[0],
      state.quaternion[1],
      state.quaternion[2],
      state.quaternion[3]
    );

    // Pitch: Up/Down arrow around local X
    if (this.input.isDown('ArrowUp')) {
      _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ROTATION_RATE * dt);
      quat.multiply(_q);
    }
    if (this.input.isDown('ArrowDown')) {
      _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), ROTATION_RATE * dt);
      quat.multiply(_q);
    }

    // Yaw: Left/Right arrow around local Y
    if (this.input.isDown('ArrowLeft')) {
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ROTATION_RATE * dt);
      quat.multiply(_q);
    }
    if (this.input.isDown('ArrowRight')) {
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ROTATION_RATE * dt);
      quat.multiply(_q);
    }

    quat.normalize();
    state.quaternion = [quat.x, quat.y, quat.z, quat.w];

    // --- Auto-prograde (T key) ---
    if (this.input.isDown('KeyT')) {
      const [vx, vy, vz] = state.stateVector.velocity;
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (speed > 0.01) {
        // Local -Z is forward; we want -Z to point along velocity
        const forward = new THREE.Vector3(-vx / speed, -vy / speed, -vz / speed);
        const up = new THREE.Vector3(0, 1, 0);
        const mat = new THREE.Matrix4().lookAt(
          new THREE.Vector3(0, 0, 0),
          forward,
          up
        );
        quat.setFromRotationMatrix(mat);
        state.quaternion = [quat.x, quat.y, quat.z, quat.w];
      }
    }

    // --- Thrust (WASD) ---
    let thrustLocal = new THREE.Vector3(0, 0, 0);
    let thrusting = false;

    if (this.input.isDown('KeyW')) {
      thrustLocal.z -= THRUST_ACCEL; // Forward (-Z)
      thrusting = true;
    }
    if (this.input.isDown('KeyS')) {
      thrustLocal.z += THRUST_ACCEL; // Backward (+Z)
      thrusting = true;
    }
    if (this.input.isDown('KeyA')) {
      thrustLocal.x -= THRUST_ACCEL; // Left
      thrusting = true;
    }
    if (this.input.isDown('KeyD')) {
      thrustLocal.x += THRUST_ACCEL; // Right
      thrusting = true;
    }

    state.thrustActive = thrusting;

    if (thrusting) {
      // Transform local thrust to ECI frame
      thrustLocal.applyQuaternion(quat);
      const eciThrust: [number, number, number] = [thrustLocal.x, thrustLocal.y, thrustLocal.z];
      state.thrustDirection = eciThrust;
      return eciThrust;
    }

    state.thrustDirection = [0, 0, 0];
    return [0, 0, 0];
  }
}
