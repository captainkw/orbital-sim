/**
 * Hermite cubic interpolation between OEM ephemeris points.
 *
 * Uses position and velocity at both bracketing endpoints to produce
 * a smooth C1-continuous trajectory between ephemeris data points.
 */

import { EphemerisPoint } from './oem-parser';

/**
 * Interpolate position and velocity at a target time using Hermite cubic
 * interpolation over the given sorted ephemeris points.
 *
 * @param points - Sorted array of ephemeris points (by epoch)
 * @param targetTime - Unix timestamp in milliseconds
 * @returns Interpolated position (meters) and velocity (m/s), or null if
 *          targetTime is outside the ephemeris range.
 */
export function interpolateState(
  points: EphemerisPoint[],
  targetTime: number
): { position: [number, number, number]; velocity: [number, number, number] } | null {
  if (points.length === 0) {
    return null;
  }

  if (targetTime < points[0].epoch || targetTime > points[points.length - 1].epoch) {
    return null;
  }

  // Exact match on last point
  if (targetTime === points[points.length - 1].epoch) {
    const last = points[points.length - 1];
    return {
      position: [last.position[0], last.position[1], last.position[2]],
      velocity: [last.velocity[0], last.velocity[1], last.velocity[2]],
    };
  }

  // Binary search for bracketing interval: find largest i where points[i].epoch <= targetTime
  let lo = 0;
  let hi = points.length - 2;

  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (points[mid].epoch <= targetTime) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  const i = lo;
  const p0 = points[i];
  const p1 = points[i + 1];

  const t0 = p0.epoch;
  const t1 = p1.epoch;
  const dtMs = t1 - t0;
  const dtSeconds = dtMs / 1000;

  // Normalized parameter [0, 1]
  const t = (targetTime - t0) / dtMs;
  const t2 = t * t;
  const t3 = t2 * t;

  // Hermite basis functions
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  // Derivatives of basis functions with respect to t
  const dh00 = 6 * t2 - 6 * t;
  const dh10 = 3 * t2 - 4 * t + 1;
  const dh01 = -6 * t2 + 6 * t;
  const dh11 = 3 * t2 - 2 * t;

  const position: [number, number, number] = [0, 0, 0];
  const velocity: [number, number, number] = [0, 0, 0];

  for (let j = 0; j < 3; j++) {
    const pos0 = p0.position[j];
    const pos1 = p1.position[j];
    // Scale velocity by dt_seconds so it's in position-units per normalized-t
    const vel0 = p0.velocity[j] * dtSeconds;
    const vel1 = p1.velocity[j] * dtSeconds;

    position[j] = h00 * pos0 + h10 * vel0 + h01 * pos1 + h11 * vel1;

    // Derivative of position w.r.t. t, divided by dtSeconds to get m/s
    velocity[j] = (dh00 * pos0 + dh10 * vel0 + dh01 * pos1 + dh11 * vel1) / dtSeconds;
  }

  return { position, velocity };
}
