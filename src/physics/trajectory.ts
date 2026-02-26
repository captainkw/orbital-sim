import { GM_EARTH } from '../constants';
import { StateVector } from '../types';
import { rk4Step } from './integrator';

/**
 * Propagate an orbit forward (no thrust) and return position samples.
 * Used for drawing the predicted orbit line.
 */
export function predictOrbit(
  sv: StateVector,
  numPoints = 1200,
  dt = 10.0
): [number, number, number][] {
  const points: [number, number, number][] = [];
  let state: [number, number, number, number, number, number] = [
    ...sv.position,
    ...sv.velocity,
  ];

  // Estimate orbital period to auto-tune propagation time
  const r = Math.sqrt(
    sv.position[0] ** 2 + sv.position[1] ** 2 + sv.position[2] ** 2
  );
  const v = Math.sqrt(
    sv.velocity[0] ** 2 + sv.velocity[1] ** 2 + sv.velocity[2] ** 2
  );
  const energy = v * v / 2 - GM_EARTH / r;
  let period: number;
  if (energy < 0) {
    const a = -GM_EARTH / (2 * energy);
    period = 2 * Math.PI * Math.sqrt(a * a * a / GM_EARTH);
  } else {
    period = numPoints * dt; // Hyperbolic/parabolic: just propagate fixed time
  }

  // Adjust dt to cover ~1.1 orbital periods
  const totalTime = period * 1.1;
  const stepDt = totalTime / numPoints;

  for (let i = 0; i < numPoints; i++) {
    points.push([state[0], state[1], state[2]]);
    state = rk4Step(state, stepDt);
  }

  return points;
}
