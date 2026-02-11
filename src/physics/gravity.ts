import { GM_EARTH } from '../constants';

/**
 * Compute gravitational acceleration at position r (meters, ECI Y-up).
 * a = -GM * r / |r|^3
 */
export function gravitationalAcceleration(
  x: number, y: number, z: number
): [number, number, number] {
  const r2 = x * x + y * y + z * z;
  const r = Math.sqrt(r2);
  const r3 = r2 * r;
  const factor = -GM_EARTH / r3;
  return [factor * x, factor * y, factor * z];
}
