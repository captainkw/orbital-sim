import { EARTH_RADIUS, GM_EARTH } from '../constants';
import { ManeuverSequence } from '../types';
import { hohmannTransfer } from '../physics/maneuver';

const LEO_ALT = 200e3; // 200 km
const GEO_ALT = 35786e3; // 35,786 km

const r_leo = EARTH_RADIUS + LEO_ALT;
const r_geo = EARTH_RADIUS + GEO_ALT;
const v_circular_leo = Math.sqrt(GM_EARTH / r_leo);

/**
 * LEO 200km circular orbit — no maneuvers, just the initial state.
 */
export function leoCircularPreset(): ManeuverSequence {
  const period = 2 * Math.PI * Math.sqrt(r_leo ** 3 / GM_EARTH);
  return {
    version: 1,
    name: 'LEO 200km Circular',
    initialState: {
      position: [r_leo, 0, 0],
      velocity: [0, 0, -v_circular_leo],
    },
    maneuvers: [],
    totalDuration: period * 2, // Two orbits
  };
}

/**
 * Hohmann transfer from LEO (200km) to GEO.
 */
export function hohmannLeoGeoPreset(): ManeuverSequence {
  const { dv1, dv2, transferTime } = hohmannTransfer(r_leo, r_geo);

  // Start in LEO circular orbit
  // First burn at T=300s (give time to observe initial orbit)
  const burnStart1 = 300;
  const burnDuration1 = 60; // 60 second burn

  // Second burn at apoapsis (after half-transfer orbit)
  const burnStart2 = burnStart1 + transferTime;
  const burnDuration2 = 60;

  const totalDuration = burnStart2 + burnDuration2 + 7200; // Extra 2 hours to observe GEO

  return {
    version: 1,
    name: 'Hohmann LEO → GEO',
    initialState: {
      position: [r_leo, 0, 0],
      velocity: [0, 0, -v_circular_leo],
    },
    maneuvers: [
      {
        id: 'burn-1-leo-departure',
        startTime: burnStart1,
        deltaV: [dv1, 0, 0], // Prograde
        duration: burnDuration1,
      },
      {
        id: 'burn-2-geo-insertion',
        startTime: burnStart2,
        deltaV: [dv2, 0, 0], // Prograde
        duration: burnDuration2,
      },
    ],
    totalDuration,
  };
}

export function getPreset(name: string): ManeuverSequence | null {
  switch (name) {
    case 'leo-circular': return leoCircularPreset();
    case 'hohmann-leo-geo': return hohmannLeoGeoPreset();
    default: return null;
  }
}
