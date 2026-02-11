import * as THREE from 'three';
import { InputManager } from './input-manager';
import { ROTATION_RATE, THRUST_ACCEL } from '../constants';
import { SpacecraftState } from '../types';

export class SpacecraftControls {
  private input: InputManager;
  private pitchOffset = 0;
  private yawOffset = 0;

  constructor(input: InputManager) {
    this.input = input;
  }

  resetOrientation() {
    this.pitchOffset = 0;
    this.yawOffset = 0;
  }

  /**
   * Apply keyboard inputs to spacecraft state using LVLH frame.
   * @param state Current spacecraft state (mutated in place)
   * @param dt Real delta time for rotation (seconds)
   * @returns Thrust acceleration vector in ECI frame (m/s^2), or [0,0,0]
   */
  update(state: SpacecraftState, dt: number): [number, number, number] {
    const [px, py, pz] = state.stateVector.position;
    const [vx, vy, vz] = state.stateVector.velocity;

    // --- Compute LVLH axes in ECI ---
    // Radial: outward from Earth center
    const radial = new THREE.Vector3(px, py, pz).normalize();

    // Velocity direction
    const vel = new THREE.Vector3(vx, vy, vz);
    const speed = vel.length();

    // Cross-track: radial × velocity (orbit normal direction)
    const crossTrack = new THREE.Vector3().crossVectors(radial, vel).normalize();

    // Prograde: cross-track × radial (in orbital plane, along velocity for circular)
    const prograde = new THREE.Vector3().crossVectors(crossTrack, radial).normalize();

    // --- Accumulate pitch/yaw offsets from arrow keys ---
    if (this.input.isDown('ArrowUp')) {
      this.pitchOffset += ROTATION_RATE * dt; // Stick forward → pitch down (nose toward Earth)
    }
    if (this.input.isDown('ArrowDown')) {
      this.pitchOffset -= ROTATION_RATE * dt; // Stick back → pitch up (nose away from Earth)
    }
    if (this.input.isDown('ArrowLeft')) {
      this.yawOffset += ROTATION_RATE * dt;
    }
    if (this.input.isDown('ArrowRight')) {
      this.yawOffset -= ROTATION_RATE * dt;
    }

    // T key: reset to prograde (zero offsets)
    if (this.input.isDown('KeyT')) {
      this.pitchOffset = 0;
      this.yawOffset = 0;
    }

    // --- Build orientation quaternion ---
    // Base LVLH orientation: spacecraft -Z points prograde, +Y points radially outward
    // We use lookAt: the spacecraft's forward (-Z) should point along prograde
    // So we make it look at -prograde (since lookAt convention points +Z at target, we flip)
    const lookTarget = new THREE.Vector3().copy(prograde).negate();
    const mat = new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      lookTarget,
      radial // "up" is radially outward
    );
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(mat);

    // Apply pitch offset (around local X axis) and yaw offset (around local Y axis)
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), this.pitchOffset
    );
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), this.yawOffset
    );

    // Final = base * yaw * pitch
    const finalQuat = baseQuat.clone().multiply(yawQuat).multiply(pitchQuat);
    finalQuat.normalize();

    state.quaternion = [finalQuat.x, finalQuat.y, finalQuat.z, finalQuat.w];

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
      thrustLocal.applyQuaternion(finalQuat);
      const eciThrust: [number, number, number] = [thrustLocal.x, thrustLocal.y, thrustLocal.z];
      state.thrustDirection = eciThrust;
      return eciThrust;
    }

    state.thrustDirection = [0, 0, 0];
    return [0, 0, 0];
  }
}
