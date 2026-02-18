import { describe, it, expect } from 'vitest';
import { hohmannTransfer } from '../src/physics/maneuver';
import { stateToElements } from '../src/physics/orbital-elements';
import { dragAcceleration } from '../src/physics/atmosphere';
import { EARTH_RADIUS, GM_EARTH } from '../src/constants';

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
