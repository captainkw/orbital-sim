import { StateVector } from '../types';
import { stateToElements } from './orbital-elements';
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
  const el = stateToElements(sv);
  const { semiMajorAxis: a, eccentricity: e, inclination: i,
          raan, argumentOfPeriapsis: aop } = el;

  // Fallback for hyperbolic/parabolic trajectories
  if (!Number.isFinite(a) || e >= 1) {
    return predictOrbitNumerical(sv, numPoints);
  }

  // Rotation matrix components (perifocal → ECI, Y-up convention)
  // Y is north pole, so we use a Y-up rotation chain: Rz(raan) * Rx(i) * Rz(aop)
  const cosO = Math.cos(raan),  sinO = Math.sin(raan);
  const cosI = Math.cos(i),     sinI = Math.sin(i);
  const cosW = Math.cos(aop),   sinW = Math.sin(aop);

  // Perifocal unit vectors expressed in ECI (Y-up)
  // P̂ = direction of perigee, Q̂ = 90° ahead in orbit plane
  const Px =  cosO * cosW - sinO * sinW * cosI;
  const Py =  sinW * sinI;
  const Pz =  sinO * cosW + cosO * sinW * cosI;

  const Qx = -cosO * sinW - sinO * cosW * cosI;
  const Qy =  cosW * sinI;
  const Qz = -sinO * sinW + cosO * cosW * cosI;

  const points: [number, number, number][] = [];
  const semiLatusRectum = a * (1 - e * e);

  for (let k = 0; k < numPoints; k++) {
    const nu = (2 * Math.PI * k) / numPoints; // true anomaly sample
    const r  = semiLatusRectum / (1 + e * Math.cos(nu));
    const rc = r * Math.cos(nu);
    const rs = r * Math.sin(nu);
    points.push([
      rc * Px + rs * Qx,
      rc * Py + rs * Qy,
      rc * Pz + rs * Qz,
    ]);
  }
  // Close the loop
  points.push(points[0]);

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
