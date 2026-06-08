import {
  eciToEcf,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  twoline2satrec,
  type OMMJsonObject,
  type SatRec,
} from 'satellite.js';
import { EARTH_EQUATORIAL_RADIUS } from '../constants';
import { magnitude, type Vector3Tuple } from './vector';

const METERS_PER_KILOMETER = 1000;

export interface TleSource {
  name?: string;
  line1: string;
  line2: string;
}

export type OmmSource = OMMJsonObject;

export interface CatalogSatellite {
  name: string;
  satrec: SatRec;
}

export interface CatalogPropagationResult {
  name: string;
  at: Date;
  frame: 'TEME';
  temePosition: Vector3Tuple; // meters
  temeVelocity: Vector3Tuple; // meters / second
  ecefPosition: Vector3Tuple; // meters
  geodetic: {
    longitudeRadians: number;
    latitudeRadians: number;
    heightMeters: number;
  };
  altitudeMeters: number;
}

function kmVectorToMeters(vector: { x: number; y: number; z: number }): Vector3Tuple {
  return [
    vector.x * METERS_PER_KILOMETER,
    vector.y * METERS_PER_KILOMETER,
    vector.z * METERS_PER_KILOMETER,
  ];
}

function kmPerSecondVectorToMetersPerSecond(vector: {
  x: number;
  y: number;
  z: number;
}): Vector3Tuple {
  return [
    vector.x * METERS_PER_KILOMETER,
    vector.y * METERS_PER_KILOMETER,
    vector.z * METERS_PER_KILOMETER,
  ];
}

export function satelliteFromTle(source: TleSource): CatalogSatellite {
  return {
    name: source.name ?? source.line1.slice(2, 7).trim(),
    satrec: twoline2satrec(source.line1, source.line2),
  };
}

export function satelliteFromOmm(source: OmmSource): CatalogSatellite {
  return {
    name: source.OBJECT_NAME,
    satrec: json2satrec(source),
  };
}

export function propagateCatalogSatellite(
  satellite: CatalogSatellite,
  at: Date
): CatalogPropagationResult {
  const result = propagate(satellite.satrec, at);
  if (result === null) {
    throw new Error(
      `SGP4 propagation failed for ${satellite.name}; SatRec error ${satellite.satrec.error}`
    );
  }

  const gmst = gstime(at);
  const ecefKm = eciToEcf(result.position, gmst);
  const geodetic = eciToGeodetic(result.position, gmst);
  const ecefPosition = kmVectorToMeters(ecefKm);

  return {
    name: satellite.name,
    at,
    frame: 'TEME',
    temePosition: kmVectorToMeters(result.position),
    temeVelocity: kmPerSecondVectorToMetersPerSecond(result.velocity),
    ecefPosition,
    geodetic: {
      longitudeRadians: geodetic.longitude,
      latitudeRadians: geodetic.latitude,
      heightMeters: geodetic.height * METERS_PER_KILOMETER,
    },
    altitudeMeters:
      magnitude(ecefPosition) - EARTH_EQUATORIAL_RADIUS,
  };
}

export function parseTleCatalog(text: string): TleSource[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const catalog: TleSource[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('1 ') && lines[i + 1]?.startsWith('2 ')) {
      catalog.push({ line1: lines[i], line2: lines[i + 1] });
      i += 1;
      continue;
    }

    if (
      lines[i + 1]?.startsWith('1 ') &&
      lines[i + 2]?.startsWith('2 ')
    ) {
      catalog.push({
        name: lines[i],
        line1: lines[i + 1],
        line2: lines[i + 2],
      });
      i += 2;
    }
  }

  return catalog;
}
