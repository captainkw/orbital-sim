import { GM_EARTH } from '../constants';

/**
 * Calculate Hohmann transfer parameters between two circular orbits.
 * @param r1 Radius of inner orbit (meters)
 * @param r2 Radius of outer orbit (meters)
 * @returns dv1 (m/s), dv2 (m/s), transferTime (seconds)
 */
export function hohmannTransfer(r1: number, r2: number) {
  const mu = GM_EARTH;

  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);

  const aTransfer = (r1 + r2) / 2;
  const vTransfer1 = Math.sqrt(mu * (2 / r1 - 1 / aTransfer));
  const vTransfer2 = Math.sqrt(mu * (2 / r2 - 1 / aTransfer));

  const dv1 = vTransfer1 - v1; // Prograde burn at periapsis
  const dv2 = v2 - vTransfer2; // Prograde burn at apoapsis

  const transferTime = Math.PI * Math.sqrt(aTransfer ** 3 / mu);

  return { dv1, dv2, transferTime };
}
