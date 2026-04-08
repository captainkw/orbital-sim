/**
 * Computes accurate Sun and Moon positions in ECI (meters, Y-up)
 * using the astronomy-engine library.
 */

import * as Astronomy from 'astronomy-engine';

/** 1 AU in meters */
const AU_TO_METERS = 149597870700;

/**
 * Convert astronomy-engine J2000 equatorial (Z-up) to our sim ECI (Y-up).
 *   sim_x =  astro_x
 *   sim_y =  astro_z
 *   sim_z = -astro_y
 */
function equatorialZUpToYUp(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [x, z, -y];
}

/**
 * Returns the Sun position in ECI Y-up coordinates, in meters.
 */
export function getSunPositionECI(date: Date): [number, number, number] {
  const vec = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  const mx = vec.x * AU_TO_METERS;
  const my = vec.y * AU_TO_METERS;
  const mz = vec.z * AU_TO_METERS;
  return equatorialZUpToYUp(mx, my, mz);
}

/**
 * Returns the Moon position in ECI Y-up coordinates, in meters.
 */
export function getMoonPositionECI(date: Date): [number, number, number] {
  const vec = Astronomy.GeoVector(Astronomy.Body.Moon, date, true);
  const mx = vec.x * AU_TO_METERS;
  const my = vec.y * AU_TO_METERS;
  const mz = vec.z * AU_TO_METERS;
  return equatorialZUpToYUp(mx, my, mz);
}

/**
 * Returns the Moon's distance from Earth center in kilometers.
 */
export function getMoonDistanceKm(date: Date): number {
  const vec = Astronomy.GeoVector(Astronomy.Body.Moon, date, true);
  const distAu = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
  return (distAu * AU_TO_METERS) / 1000;
}
