import {
  ASTRONOMICAL_UNIT,
  EARTH_EQUATORIAL_RADIUS,
  GM_EARTH,
  GM_MOON,
  GM_SUN,
  J2_EARTH,
  SOLAR_RADIATION_PRESSURE_1_AU,
} from '../constants';
import {
  add,
  magnitude,
  normalize,
  scale,
  subtract,
  type Vector3Tuple,
} from './vector';

export interface SpacecraftPhysicalProperties {
  massKg: number;
  dragCoefficient: number;
  crossSectionAreaM2: number;
  reflectivityCoefficient?: number;
}

export interface ThirdBody {
  position: Vector3Tuple; // body position relative to Earth, meters
  gm: number; // gravitational parameter, m^3/s^2
}

export interface PerturbationOptions {
  includeJ2?: boolean;
  includeSolarRadiationPressure?: boolean;
  includeThirdBody?: boolean;
  sunPosition?: Vector3Tuple;
  moonPosition?: Vector3Tuple;
  thirdBodies?: ThirdBody[];
  spacecraft?: SpacecraftPhysicalProperties;
}

const DEFAULT_SUN_POSITION: Vector3Tuple = [ASTRONOMICAL_UNIT, 0, 0];
const DEFAULT_MOON_POSITION: Vector3Tuple = [384_400_000, 0, 0];
const DEFAULT_SPACECRAFT: SpacecraftPhysicalProperties = {
  massKg: 1000,
  dragCoefficient: 2.2,
  crossSectionAreaM2: 10,
  reflectivityCoefficient: 1.3,
};

export function j2Acceleration(
  x: number,
  y: number,
  z: number
): Vector3Tuple {
  const r2 = x * x + y * y + z * z;
  const r = Math.sqrt(r2);
  const r5 = r2 * r2 * r;
  const z2OverR2 = (z * z) / r2;
  const factor =
    (1.5 * J2_EARTH * GM_EARTH * EARTH_EQUATORIAL_RADIUS ** 2) / r5;

  return [
    factor * x * (5 * z2OverR2 - 1),
    factor * y * (5 * z2OverR2 - 1),
    factor * z * (5 * z2OverR2 - 3),
  ];
}

export function thirdBodyAcceleration(
  satellitePosition: Vector3Tuple,
  body: ThirdBody
): Vector3Tuple {
  const satelliteToBody = subtract(body.position, satellitePosition);
  const earthToBody = body.position;
  const satDistance = magnitude(satelliteToBody);
  const earthDistance = magnitude(earthToBody);

  return scale(
    subtract(
      scale(satelliteToBody, 1 / satDistance ** 3),
      scale(earthToBody, 1 / earthDistance ** 3)
    ),
    body.gm
  );
}

export function solarRadiationPressureAcceleration({
  satellitePosition,
  sunPosition = DEFAULT_SUN_POSITION,
  spacecraft = DEFAULT_SPACECRAFT,
}: {
  satellitePosition: Vector3Tuple;
  sunPosition?: Vector3Tuple;
  spacecraft?: SpacecraftPhysicalProperties;
}): Vector3Tuple {
  const sunToSatellite = subtract(satellitePosition, sunPosition);
  const distanceToSun = magnitude(sunToSatellite);
  const pressure =
    SOLAR_RADIATION_PRESSURE_1_AU *
    (ASTRONOMICAL_UNIT / distanceToSun) ** 2;
  const reflectivity = spacecraft.reflectivityCoefficient ?? 1.3;
  const accelerationMagnitude =
    (pressure * reflectivity * spacecraft.crossSectionAreaM2) /
    spacecraft.massKg;

  return scale(normalize(sunToSatellite), accelerationMagnitude);
}

export function perturbationAcceleration(
  position: Vector3Tuple,
  options: PerturbationOptions = {}
): Vector3Tuple {
  let acceleration: Vector3Tuple = [0, 0, 0];

  if (options.includeJ2) {
    acceleration = add(
      acceleration,
      j2Acceleration(position[0], position[1], position[2])
    );
  }

  if (options.includeSolarRadiationPressure) {
    acceleration = add(
      acceleration,
      solarRadiationPressureAcceleration({
        satellitePosition: position,
        sunPosition: options.sunPosition,
        spacecraft: options.spacecraft,
      })
    );
  }

  if (options.includeThirdBody) {
    const bodies =
      options.thirdBodies ??
      [
        { position: options.sunPosition ?? DEFAULT_SUN_POSITION, gm: GM_SUN },
        { position: options.moonPosition ?? DEFAULT_MOON_POSITION, gm: GM_MOON },
      ];

    for (const body of bodies) {
      acceleration = add(
        acceleration,
        thirdBodyAcceleration(position, body)
      );
    }
  }

  return acceleration;
}
