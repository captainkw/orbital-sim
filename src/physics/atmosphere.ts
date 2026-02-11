import { EARTH_RADIUS } from '../constants';

// Atmospheric model constants
const SEA_LEVEL_DENSITY = 1.225; // kg/m^3
const SCALE_HEIGHT = 8500; // meters
const ATMOSPHERE_CEILING = 600e3; // meters altitude — skip drag above this

// Spacecraft constants
const DRAG_COEFFICIENT = 2.2;
const CROSS_SECTION_AREA = 10; // m^2
const SPACECRAFT_MASS = 1000; // kg

/**
 * Exponential atmospheric density model.
 * Returns density in kg/m^3 at the given altitude (meters above sea level).
 */
function atmosphericDensity(altitude: number): number {
  if (altitude > ATMOSPHERE_CEILING || altitude < 0) return 0;
  return SEA_LEVEL_DENSITY * Math.exp(-altitude / SCALE_HEIGHT);
}

/**
 * Compute drag acceleration vector in ECI frame.
 * @param x, y, z — position in meters (ECI)
 * @param vx, vy, vz — velocity in m/s (ECI)
 * @returns [ax, ay, az] drag acceleration in m/s^2 (opposing velocity)
 */
export function dragAcceleration(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number
): [number, number, number] {
  const r = Math.sqrt(x * x + y * y + z * z);
  const altitude = r - EARTH_RADIUS;

  if (altitude > ATMOSPHERE_CEILING || altitude < 0) return [0, 0, 0];

  const rho = atmosphericDensity(altitude);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed < 1e-6) return [0, 0, 0];

  // Drag magnitude: 0.5 * rho * Cd * A * v^2 / mass
  const dragMag = 0.5 * rho * DRAG_COEFFICIENT * CROSS_SECTION_AREA * speed * speed / SPACECRAFT_MASS;

  // Drag opposes velocity
  return [
    -dragMag * vx / speed,
    -dragMag * vy / speed,
    -dragMag * vz / speed,
  ];
}

/**
 * Get the drag acceleration magnitude for HUD display.
 */
export function dragMagnitude(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number
): number {
  const [dx, dy, dz] = dragAcceleration(x, y, z, vx, vy, vz);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
