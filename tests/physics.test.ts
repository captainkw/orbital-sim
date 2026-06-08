import { describe, it, expect } from 'vitest';
import { hohmannTransfer } from '../src/physics/maneuver';
import { stateToElements } from '../src/physics/orbital-elements';
import { dragAcceleration } from '../src/physics/atmosphere';
import {
  ASTRONOMICAL_UNIT,
  EARTH_RADIUS,
  GM_EARTH,
} from '../src/constants';
import { rk4Step } from '../src/physics/integrator';
import {
  j2Acceleration,
  solarRadiationPressureAcceleration,
  thirdBodyAcceleration,
} from '../src/physics/perturbations';
import {
  parseTleCatalog,
  propagateCatalogSatellite,
  satelliteFromOmm,
  satelliteFromTle,
} from '../src/physics/sgp4';

describe('hohmannTransfer', () => {
  it('produces reasonable values for LEO to GEO', () => {
    const r1 = EARTH_RADIUS + 200e3;
    const r2 = EARTH_RADIUS + 35786e3;
    const { dv1, dv2, transferTime } = hohmannTransfer(r1, r2);

    expect(dv1).toBeGreaterThan(2300);
    expect(dv1).toBeLessThan(2600);
    expect(dv2).toBeGreaterThan(1400);
    expect(dv2).toBeLessThan(1700);
    expect(transferTime).toBeGreaterThan(16000);
    expect(transferTime).toBeLessThan(22000);
  });

  it('returns near-zero burns for identical orbits', () => {
    const r = EARTH_RADIUS + 400e3;
    const { dv1, dv2 } = hohmannTransfer(r, r);
    expect(Math.abs(dv1)).toBeLessThan(1e-9);
    expect(Math.abs(dv2)).toBeLessThan(1e-9);
  });
});

describe('stateToElements', () => {
  it('matches a circular equatorial orbit', () => {
    const r = EARTH_RADIUS + 600e3;
    const v = Math.sqrt(GM_EARTH / r);
    const elements = stateToElements({
      position: [r, 0, 0],
      velocity: [0, 0, -v],
    });

    expect(elements.semiMajorAxis).toBeCloseTo(r, 6);
    expect(elements.eccentricity).toBeLessThan(1e-6);
    expect(elements.inclination).toBeLessThan(1e-6);
  });
});

describe('dragAcceleration', () => {
  it('is zero above atmosphere ceiling', () => {
    const r = EARTH_RADIUS + 700e3;
    const [ax, ay, az] = dragAcceleration(r, 0, 0, 7500, 0, 0);
    expect(ax).toBe(0);
    expect(ay).toBe(0);
    expect(az).toBe(0);
  });

  it('opposes velocity at sea level', () => {
    const [ax, ay, az] = dragAcceleration(EARTH_RADIUS, 0, 0, 100, 0, 0);
    expect(ax).toBeLessThan(0);
    expect(Math.abs(ay)).toBeLessThan(1e-12);
    expect(Math.abs(az)).toBeLessThan(1e-12);
  });
});

describe('perturbation accelerations', () => {
  it('adds inward J2 acceleration over the equator', () => {
    const r = EARTH_RADIUS + 600e3;
    const [ax, ay, az] = j2Acceleration(r, 0, 0);

    expect(ax).toBeLessThan(0);
    expect(Math.abs(ay)).toBeLessThan(1e-15);
    expect(Math.abs(az)).toBeLessThan(1e-15);
  });

  it('computes solar radiation pressure away from the sun', () => {
    const acceleration = solarRadiationPressureAcceleration({
      satellitePosition: [0, 0, 0],
      sunPosition: [ASTRONOMICAL_UNIT, 0, 0],
      spacecraft: {
        massKg: 1000,
        crossSectionAreaM2: 10,
        dragCoefficient: 2.2,
        reflectivityCoefficient: 1.3,
      },
    });

    expect(acceleration[0]).toBeLessThan(0);
    expect(Math.abs(acceleration[1])).toBeLessThan(1e-15);
    expect(Math.abs(acceleration[2])).toBeLessThan(1e-15);
  });

  it('computes third-body differential acceleration', () => {
    const acceleration = thirdBodyAcceleration([7_000_000, 0, 0], {
      position: [384_400_000, 0, 0],
      gm: 4.9048695e12,
    });

    expect(acceleration[0]).toBeGreaterThan(0);
    expect(Math.abs(acceleration[1])).toBeLessThan(1e-15);
    expect(Math.abs(acceleration[2])).toBeLessThan(1e-15);
  });

  it('lets RK4 opt into perturbations without changing existing call sites', () => {
    const r = EARTH_RADIUS + 600e3;
    const v = Math.sqrt(GM_EARTH / r);
    const state: [number, number, number, number, number, number] = [
      r,
      0,
      0,
      0,
      0,
      -v,
    ];

    const twoBody = rk4Step(state, 10);
    const withJ2 = rk4Step(state, 10, [0, 0, 0], {
      perturbations: { includeJ2: true },
    });

    expect(withJ2[0]).toBeLessThan(twoBody[0]);
  });
});

describe('public catalog SGP4 propagation', () => {
  const issTle = {
    name: 'ISS (ZARYA)',
    line1:
      '1 25544U 98067A   24150.51848450  .00016717  00000+0  30419-3 0  9998',
    line2:
      '2 25544  51.6395  75.5196 0005277  50.5156  64.7783 15.49473516456255',
  };

  it('parses named TLE catalogs', () => {
    const catalog = parseTleCatalog(
      `${issTle.name}\n${issTle.line1}\n${issTle.line2}\n`
    );

    expect(catalog).toEqual([issTle]);
  });

  it('propagates TLEs with SGP4 and returns TEME plus ECEF coordinates', () => {
    const satellite = satelliteFromTle(issTle);
    const result = propagateCatalogSatellite(
      satellite,
      new Date('2024-05-29T12:26:37Z')
    );

    expect(result.name).toBe('ISS (ZARYA)');
    expect(result.frame).toBe('TEME');
    expect(result.altitudeMeters).toBeGreaterThan(350_000);
    expect(result.altitudeMeters).toBeLessThan(500_000);
    expect(result.temePosition[0]).not.toBeCloseTo(result.ecefPosition[0], 3);
    expect(result.geodetic.heightMeters).toBeGreaterThan(350_000);
  });

  it('propagates OMM/GP JSON with BSTAR through SGP4', () => {
    const satellite = satelliteFromOmm({
      OBJECT_NAME: 'HELIOS 2A',
      OBJECT_ID: '2004-049A',
      EPOCH: '2025-03-26T05:19:34.116960',
      MEAN_MOTION: 15.00555103,
      ECCENTRICITY: 0.000583,
      INCLINATION: 98.3164,
      RA_OF_ASC_NODE: 103.8411,
      ARG_OF_PERICENTER: 20.5667,
      MEAN_ANOMALY: 339.5789,
      EPHEMERIS_TYPE: 0,
      CLASSIFICATION_TYPE: 'U',
      NORAD_CAT_ID: 28492,
      ELEMENT_SET_NO: 999,
      REV_AT_EPOCH: 8655,
      BSTAR: 0.00048021,
      MEAN_MOTION_DOT: 0.00005995,
      MEAN_MOTION_DDOT: 0,
    });

    const result = propagateCatalogSatellite(
      satellite,
      new Date('2025-03-26T05:19:34.116960Z')
    );

    expect(result.name).toBe('HELIOS 2A');
    expect(result.altitudeMeters).toBeGreaterThan(400_000);
    expect(result.altitudeMeters).toBeLessThan(700_000);
  });
});
