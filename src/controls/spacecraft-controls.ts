import * as THREE from 'three';
import { InputManager } from './input-manager';
import { ROTATION_RATE } from '../constants';
import { SpacecraftState } from '../types';

export class SpacecraftControls {
  private input: InputManager;
  private pitchOffset = 0;
  private yawOffset = 0;
  private lastQuat = new THREE.Quaternion(0, 0, 0, 1);

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
  update(state: SpacecraftState, dt: number, thrustAccel = 10.0): [number, number, number] {
    const [px, py, pz] = state.stateVector.position;
    const [vx, vy, vz] = state.stateVector.velocity;

    // --- Compute LVLH axes in ECI ---
    // Radial: outward from Earth center
    const radial = new THREE.Vector3(px, py, pz).normalize();

    // Velocity direction
    const vel = new THREE.Vector3(vx, vy, vz);
    const speed = vel.length();

    // Guard against degenerate velocity vectors to avoid NaNs.
    if (speed < 1e-6) {
      state.quaternion = [this.lastQuat.x, this.lastQuat.y, this.lastQuat.z, this.lastQuat.w];
      return this.applyThrust(state, this.lastQuat, thrustAccel);
    }

    // Cross-track: radial × velocity (orbit normal direction)
    const crossTrack = new THREE.Vector3().crossVectors(radial, vel);
    if (crossTrack.lengthSq() < 1e-12) {
      state.quaternion = [this.lastQuat.x, this.lastQuat.y, this.lastQuat.z, this.lastQuat.w];
      return this.applyThrust(state, this.lastQuat, thrustAccel);
    }
    crossTrack.normalize();

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

    this.lastQuat.copy(finalQuat);
    state.quaternion = [finalQuat.x, finalQuat.y, finalQuat.z, finalQuat.w];

    return this.applyThrust(state, finalQuat, thrustAccel);
  }

  private applyThrust(state: SpacecraftState, quat: THREE.Quaternion, thrustAccel: number): [number, number, number] {
    // --- Thrust (WASD) ---
    let thrustLocal = new THREE.Vector3(0, 0, 0);
    let thrusting = false;

    if (this.input.isDown('KeyW')) {
      thrustLocal.z += thrustAccel; // Forward (+Z = prograde)
      thrusting = true;
    }
    if (this.input.isDown('KeyS')) {
      thrustLocal.z -= thrustAccel; // Backward (-Z = retrograde)
      thrusting = true;
    }
    if (this.input.isDown('KeyA')) {
      thrustLocal.x += thrustAccel; // Left/port (+X)
      thrusting = true;
    }
    if (this.input.isDown('KeyD')) {
      thrustLocal.x -= thrustAccel; // Right/starboard (-X)
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
