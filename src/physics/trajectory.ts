import { GM_EARTH } from '../constants';
import { StateVector } from '../types';
import { rk4Step } from './integrator';

/**
 * Generate orbit line positions analytically from the current Keplerian elements.
 *
 * This replaces the old RK4-based predictOrbit. Benefits:
 *  - Runs every frame cheaply (pure trig, no integration)
 *  - Perfectly smooth — no prediction-tick jitter or flickering at close zoom
 *  - Correct by construction: a, e, i, Ω, ω define an exact ellipse
 *
 * For hyperbolic / escape trajectories (e >= 1) falls back to a short
 * numerical propagation.
 */
export function predictOrbit(
  sv: StateVector,
  numPoints = 1200,
): [number, number, number][] {
  const [x, y, z] = sv.position;
  const [vx, vy, vz] = sv.velocity;

  const rMag = Math.hypot(x, y, z);
  const vMag = Math.hypot(vx, vy, vz);
  if (rMag < 1e-9 || vMag < 1e-9) {
    return predictOrbitNumerical(sv, numPoints);
  }

  // Specific angular momentum h = r x v (orbit plane normal)
  const hx = y * vz - z * vy;
  const hy = z * vx - x * vz;
  const hz = x * vy - y * vx;
  const hMag = Math.hypot(hx, hy, hz);
  if (hMag < 1e-9) {
    return predictOrbitNumerical(sv, numPoints);
  }
  const hHatX = hx / hMag;
  const hHatY = hy / hMag;
  const hHatZ = hz / hMag;

  // Eccentricity vector: e = ((v^2 - mu/r) r - (r·v) v) / mu
  const rDotV = x * vx + y * vy + z * vz;
  const alpha = vMag * vMag - GM_EARTH / rMag;
  const ex = (alpha * x - rDotV * vx) / GM_EARTH;
  const ey = (alpha * y - rDotV * vy) / GM_EARTH;
  const ez = (alpha * z - rDotV * vz) / GM_EARTH;
  const e = Math.hypot(ex, ey, ez);

  // Specific orbital energy and semi-major axis
  const energy = (vMag * vMag) / 2 - GM_EARTH / rMag;
  if (energy >= 0) {
    return predictOrbitNumerical(sv, numPoints);
  }
  const a = -GM_EARTH / (2 * energy);
  if (!Number.isFinite(a) || a <= 0 || e >= 1) {
    return predictOrbitNumerical(sv, numPoints);
  }

  // Build a stable in-plane basis.
  // For e ~= 0, argument of perigee is undefined and can jump frame-to-frame.
  // In that case anchor to current radius direction to avoid singularity flicker.
  let pX: number;
  let pY: number;
  let pZ: number;
  if (e > 1e-4) {
    pX = ex / e;
    pY = ey / e;
    pZ = ez / e;
  } else {
    pX = x / rMag;
    pY = y / rMag;
    pZ = z / rMag;
  }

  // Orthogonalize p against h to suppress accumulated numeric drift.
  const pDotH = pX * hHatX + pY * hHatY + pZ * hHatZ;
  pX -= pDotH * hHatX;
  pY -= pDotH * hHatY;
  pZ -= pDotH * hHatZ;
  const pMag = Math.hypot(pX, pY, pZ);
  if (pMag < 1e-9) {
    return predictOrbitNumerical(sv, numPoints);
  }
  pX /= pMag;
  pY /= pMag;
  pZ /= pMag;

  // q = h x p
  const qX = hHatY * pZ - hHatZ * pY;
  const qY = hHatZ * pX - hHatX * pZ;
  const qZ = hHatX * pY - hHatY * pX;

  const points: [number, number, number][] = [];
  const semiLatusRectum = a * (1 - e * e);
  const cosNu0 = Math.max(-1, Math.min(1, (x * pX + y * pY + z * pZ) / rMag));
  const sinNu0 = (x * qX + y * qY + z * qZ) / rMag;
  const nu0 = Math.atan2(sinNu0, cosNu0);

  for (let k = 0; k < numPoints; k++) {
    const nu = nu0 + (2 * Math.PI * k) / numPoints; // phase-lock to current state
    const r  = semiLatusRectum / (1 + e * Math.cos(nu));
    const rc = r * Math.cos(nu);
    const rs = r * Math.sin(nu);
    points.push([
      rc * pX + rs * qX,
      rc * pY + rs * qY,
      rc * pZ + rs * qZ,
    ]);
  }
  // Ensure line starts/ends exactly at current spacecraft position.
  points[0] = [x, y, z];
  points.push([x, y, z]);

  return points;
}

/** Numerical fallback for escape / hyperbolic trajectories. */
function predictOrbitNumerical(
  sv: StateVector,
  numPoints: number,
): [number, number, number][] {
  const points: [number, number, number][] = [];
  let state: [number, number, number, number, number, number] = [...sv.position, ...sv.velocity];
  const dt = 30;
  for (let i = 0; i < numPoints; i++) {
    points.push([state[0], state[1], state[2]]);
    state = rk4Step(state, dt);
  }
  return points;
}
