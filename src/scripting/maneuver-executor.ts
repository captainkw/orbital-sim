import * as THREE from 'three';
import { ManeuverNode, ManeuverSequence, SpacecraftState } from '../types';

/**
 * Executes scripted maneuver sequences.
 * Each physics step, returns thrust acceleration in ECI frame.
 */
export class ManeuverExecutor {
  private sequence: ManeuverSequence | null = null;
  private activeManeuver: ManeuverNode | null = null;

  loadSequence(seq: ManeuverSequence) {
    this.sequence = seq;
    this.activeManeuver = null;
  }

  clear() {
    this.sequence = null;
    this.activeManeuver = null;
  }

  /**
   * Get thrust acceleration for the current sim time.
   * @returns ECI thrust vector (m/s^2) or [0,0,0]
   */
  getThrustAtTime(
    simTime: number,
    state: SpacecraftState,
    thrustMagnitude: number
  ): [number, number, number] {
    if (!this.sequence) return [0, 0, 0];

    // Find active maneuver
    let active: ManeuverNode | null = null;
    for (const m of this.sequence.maneuvers) {
      if (simTime >= m.startTime && simTime < m.startTime + m.duration) {
        active = m;
        break;
      }
    }

    this.activeManeuver = active;
    if (!active) return [0, 0, 0];

    // deltaV is [prograde, normal, radial]
    // We need to convert to ECI frame using the current velocity direction
    const [vx, vy, vz] = state.stateVector.velocity;
    const [px, py, pz] = state.stateVector.position;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed < 0.01) return [0, 0, 0];

    // Prograde unit vector
    const prograde = new THREE.Vector3(vx / speed, vy / speed, vz / speed);

    // Radial: from Earth center toward spacecraft
    const rMag = Math.sqrt(px * px + py * py + pz * pz);
    const radial = new THREE.Vector3(px / rMag, py / rMag, pz / rMag);

    // Normal: perpendicular to orbit plane (h direction)
    const normal = new THREE.Vector3().crossVectors(radial, prograde).normalize();

    // Recalculate radial to ensure orthogonal frame
    radial.crossVectors(prograde, normal).normalize();

    // Build thrust in ECI from prograde/normal/radial components
    // Thrust acceleration = deltaV / duration (constant thrust)
    const [dvPro, dvNorm, dvRad] = active.deltaV;
    const accelPro = dvPro / active.duration;
    const accelNorm = dvNorm / active.duration;
    const accelRad = dvRad / active.duration;

    const thrust = new THREE.Vector3()
      .addScaledVector(prograde, accelPro)
      .addScaledVector(normal, accelNorm)
      .addScaledVector(radial, accelRad);

    // Also auto-orient spacecraft to prograde during scripted maneuvers
    const forward = prograde.clone().negate(); // -Z is forward
    const up = new THREE.Vector3(0, 1, 0);
    const mat = new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      forward,
      up
    );
    const q = new THREE.Quaternion().setFromRotationMatrix(mat);
    state.quaternion = [q.x, q.y, q.z, q.w];
    state.thrustActive = true;
    state.thrustDirection = [thrust.x, thrust.y, thrust.z];

    return [thrust.x, thrust.y, thrust.z];
  }

  get isActive(): boolean {
    return this.activeManeuver !== null;
  }
}
