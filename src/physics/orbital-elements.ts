import { GM_EARTH } from '../constants';
import { OrbitalElements, StateVector } from '../types';

/**
 * Convert state vector to Keplerian orbital elements.
 * Adapted for Y-up coordinate system (Y = north pole, XZ = equatorial plane).
 */
export function stateToElements(sv: StateVector): OrbitalElements {
  const [x, y, z] = sv.position;
  const [vx, vy, vz] = sv.velocity;

  const r = Math.sqrt(x * x + y * y + z * z);
  const v = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // Specific angular momentum h = r × v
  const hx = y * vz - z * vy;
  const hy = z * vx - x * vz;
  const hz = x * vy - y * vx;
  const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

  // Node vector n = (0,1,0) × h (Y-up: north pole is Y axis)
  const nodeX = hz;
  const nodeY = 0;
  const nodeZ = -hx;
  const nMag = Math.sqrt(nodeX * nodeX + nodeZ * nodeZ);

  // Eccentricity vector e = (v × h)/GM - r_hat
  // e = ((v^2 - GM/r) * r - (r·v) * v) / GM
  const rdotv = x * vx + y * vy + z * vz;
  const v2 = v * v;
  const mu = GM_EARTH;
  const factor1 = (v2 - mu / r) / mu;
  const factor2 = rdotv / mu;

  const ex = factor1 * x - factor2 * vx;
  const ey = factor1 * y - factor2 * vy;
  const ez = factor1 * z - factor2 * vz;
  const eccentricity = Math.sqrt(ex * ex + ey * ey + ez * ez);

  // Semi-major axis
  const energy = v2 / 2 - mu / r;
  const semiMajorAxis = energy < 0 ? -mu / (2 * energy) : Infinity;

  // Inclination: angle between h and Y-axis (north pole)
  const inclination = Math.acos(Math.max(-1, Math.min(1, hy / hMag)));

  // RAAN: angle of node vector from X-axis in XZ plane
  let raan = 0;
  if (nMag > 1e-10) {
    raan = Math.acos(Math.max(-1, Math.min(1, nodeX / nMag)));
    if (nodeZ > 0) raan = 2 * Math.PI - raan; // If node.z > 0, RAAN is past 180°
  }

  // Argument of periapsis
  let argumentOfPeriapsis = 0;
  if (nMag > 1e-10 && eccentricity > 1e-10) {
    const ndote = nodeX * ex + nodeY * ey + nodeZ * ez;
    argumentOfPeriapsis = Math.acos(Math.max(-1, Math.min(1, ndote / (nMag * eccentricity))));
    if (ey < 0) argumentOfPeriapsis = 2 * Math.PI - argumentOfPeriapsis;
  }

  // True anomaly
  let trueAnomaly = 0;
  if (eccentricity > 1e-10) {
    const edotr = ex * x + ey * y + ez * z;
    trueAnomaly = Math.acos(Math.max(-1, Math.min(1, edotr / (eccentricity * r))));
    if (rdotv < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
  }

  return {
    semiMajorAxis,
    eccentricity,
    inclination,
    raan,
    argumentOfPeriapsis,
    trueAnomaly,
  };
}
