import { EARTH_RADIUS, GM_EARTH } from '../constants';
import { ManeuverSequence } from '../types';
import { hohmannTransfer } from '../physics/maneuver';

/**
 * Build a Hohmann transfer preset between two circular orbit altitudes.
 * Handles both orbit raising (from < to) and lowering (from > to).
 */
export function buildHohmannPreset(name: string, fromAltKm: number, toAltKm: number): ManeuverSequence {
  const r1 = EARTH_RADIUS + fromAltKm * 1000;
  const r2 = EARTH_RADIUS + toAltKm * 1000;

  const rInner = Math.min(r1, r2);
  const rOuter = Math.max(r1, r2);
  const { dv1, dv2, transferTime } = hohmannTransfer(rInner, rOuter);

  const raising = fromAltKm < toAltKm;

  // Initial circular orbit at fromAltKm
  const vCircular = Math.sqrt(GM_EARTH / r1);

  const burnStart1 = 300;
  const burnDuration1 = 60;
  const burnStart2 = burnStart1 + transferTime;
  const burnDuration2 = 60;
  const totalDuration = burnStart2 + burnDuration2 + 7200; // 2hr observation

  let maneuvers;
  if (raising) {
    // Prograde: injection burn at periapsis, circularization at apoapsis
    maneuvers = [
      {
        id: 'Transfer Injection',
        startTime: burnStart1,
        deltaV: [dv1, 0, 0] as [number, number, number],
        duration: burnDuration1,
      },
      {
        id: 'Circularization',
        startTime: burnStart2,
        deltaV: [dv2, 0, 0] as [number, number, number],
        duration: burnDuration2,
      },
    ];
  } else {
    // Retrograde: deorbit burn at apoapsis, circularization at periapsis
    maneuvers = [
      {
        id: 'Deorbit Burn',
        startTime: burnStart1,
        deltaV: [-dv2, 0, 0] as [number, number, number],
        duration: burnDuration1,
      },
      {
        id: 'Circularization',
        startTime: burnStart2,
        deltaV: [-dv1, 0, 0] as [number, number, number],
        duration: burnDuration2,
      },
    ];
  }

  return {
    version: 1,
    name,
    initialState: {
      position: [r1, 0, 0],
      velocity: [0, 0, -vCircular],
    },
    maneuvers,
    totalDuration,
  };
}

/**
 * LEO 200km circular orbit — no maneuvers.
 */
export function leoCircularPreset(): ManeuverSequence {
  const r = EARTH_RADIUS + 200e3;
  const v = Math.sqrt(GM_EARTH / r);
  const period = 2 * Math.PI * Math.sqrt(r ** 3 / GM_EARTH);
  return {
    version: 1,
    name: 'LEO 200km Circular',
    initialState: {
      position: [r, 0, 0],
      velocity: [0, 0, -v],
    },
    maneuvers: [],
    totalDuration: period * 2,
  };
}

/** Hohmann LEO (200km) → GEO (35786km) */
export function hohmannLeoGeoPreset(): ManeuverSequence {
  return buildHohmannPreset('Hohmann LEO → GEO', 200, 35786);
}

/** Hohmann LEO (200km) → MEO (20200km) */
export function hohmannLeoMeoPreset(): ManeuverSequence {
  return buildHohmannPreset('Hohmann LEO → MEO', 200, 20200);
}

/** Orbit raise 400km → 800km */
export function orbitRaisePreset(): ManeuverSequence {
  return buildHohmannPreset('Orbit Raise 400→800km', 400, 800);
}

/** Orbit lower 800km → 400km */
export function orbitLowerPreset(): ManeuverSequence {
  return buildHohmannPreset('Orbit Lower 800→400km', 800, 400);
}

export function getPreset(name: string): ManeuverSequence | null {
  switch (name) {
    case 'leo-circular': return leoCircularPreset();
    case 'hohmann-leo-geo': return hohmannLeoGeoPreset();
    case 'hohmann-leo-meo': return hohmannLeoMeoPreset();
    case 'orbit-raise': return orbitRaisePreset();
    case 'orbit-lower': return orbitLowerPreset();
    default: return null;
  }
}
