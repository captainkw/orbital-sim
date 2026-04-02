/**
 * AROW telemetry client.
 *
 * Manages uploaded OEM ephemeris data and provides interpolated
 * spacecraft state at any requested time.
 */

import { parseOEM, OEMEphemeris } from './oem-parser';
import { interpolateState } from './interpolator';

export class AROWClient {
  status: 'empty' | 'ready' = 'empty';
  ephemeris: OEMEphemeris | null = null;

  /**
   * Parse OEM text and load the ephemeris data.
   * @returns true if parsing succeeded, false otherwise.
   */
  loadFromText(text: string): boolean {
    const parsed = parseOEM(text);
    if (!parsed) {
      this.status = 'empty';
      this.ephemeris = null;
      return false;
    }
    this.ephemeris = parsed;
    this.status = 'ready';
    return true;
  }

  /**
   * Interpolate spacecraft state at the given date.
   * @returns Position (meters, ECI Y-up) and velocity (m/s), or null if
   *          no ephemeris is loaded or the date is outside the valid range.
   */
  getStateAtTime(
    date: Date
  ): { position: [number, number, number]; velocity: [number, number, number] } | null {
    if (!this.ephemeris) {
      return null;
    }
    return interpolateState(this.ephemeris.points, date.getTime());
  }

  /**
   * @returns The time of the first ephemeris point, or null if not loaded.
   */
  getStartTime(): Date | null {
    if (!this.ephemeris) {
      return null;
    }
    return new Date(this.ephemeris.startTime);
  }

  /**
   * @returns The time of the last ephemeris point, or null if not loaded.
   */
  getEndTime(): Date | null {
    if (!this.ephemeris) {
      return null;
    }
    return new Date(this.ephemeris.stopTime);
  }

  /**
   * Return all position points from the ephemeris for drawing the orbit line.
   */
  getTrajectoryPoints(): [number, number, number][] {
    if (!this.ephemeris) {
      return [];
    }
    return this.ephemeris.points.map((p) => [
      p.position[0],
      p.position[1],
      p.position[2],
    ] as [number, number, number]);
  }

  /**
   * Returns the start time as the assumed launch epoch.
   */
  getLaunchEpoch(): Date | null {
    return this.getStartTime();
  }
}
