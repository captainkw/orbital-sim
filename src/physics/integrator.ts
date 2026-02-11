import { gravitationalAcceleration } from './gravity';

// State: [x, y, z, vx, vy, vz]
type State6 = [number, number, number, number, number, number];

/**
 * Derivative function: returns [vx, vy, vz, ax, ay, az]
 * thrust is additional acceleration in ECI frame (m/s^2)
 */
function derivative(
  state: State6,
  thrust: [number, number, number]
): State6 {
  const [x, y, z, vx, vy, vz] = state;
  const [gx, gy, gz] = gravitationalAcceleration(x, y, z);
  return [
    vx,
    vy,
    vz,
    gx + thrust[0],
    gy + thrust[1],
    gz + thrust[2],
  ];
}

function addScaled(a: State6, b: State6, s: number): State6 {
  return [
    a[0] + b[0] * s,
    a[1] + b[1] * s,
    a[2] + b[2] * s,
    a[3] + b[3] * s,
    a[4] + b[4] * s,
    a[5] + b[5] * s,
  ];
}

/**
 * Single RK4 integration step.
 * @param state Current state [x, y, z, vx, vy, vz] in meters and m/s
 * @param dt Timestep in seconds
 * @param thrust Additional acceleration [ax, ay, az] in m/s^2 (ECI frame)
 * @returns New state after dt
 */
export function rk4Step(
  state: State6,
  dt: number,
  thrust: [number, number, number] = [0, 0, 0]
): State6 {
  const k1 = derivative(state, thrust);
  const k2 = derivative(addScaled(state, k1, dt / 2), thrust);
  const k3 = derivative(addScaled(state, k2, dt / 2), thrust);
  const k4 = derivative(addScaled(state, k3, dt), thrust);

  return [
    state[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    state[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    state[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    state[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
    state[4] + (dt / 6) * (k1[4] + 2 * k2[4] + 2 * k3[4] + k4[4]),
    state[5] + (dt / 6) * (k1[5] + 2 * k2[5] + 2 * k3[5] + k4[5]),
  ];
}
