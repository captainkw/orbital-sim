import { EARTH_RADIUS, GM_EARTH } from '../constants';
import { ManeuverSequence, StateVector } from '../types';
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
 * LEO 600km circular orbit — no maneuvers.
 */
export function leoCircularPreset(): ManeuverSequence {
  const r = EARTH_RADIUS + 600e3;
  const v = Math.sqrt(GM_EARTH / r);
  const period = 2 * Math.PI * Math.sqrt(r ** 3 / GM_EARTH);
  return {
    version: 1,
    name: 'LEO 600km Circular',
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

/**
 * ISS Rendezvous & Docking — shuttle starts at 350 km phasing orbit, catches
 * up to ISS at 408 km over 2 phasing orbits, then executes a Hohmann raise
 * to match the ISS orbit.
 *
 * Phase geometry: shuttle at φ=0, ISS placed ahead by (requiredLead + phaseGain)
 * so that after 2 phasing orbits the geometry is correct for the TI burn.
 */
export function issRendezvousPreset(): ManeuverSequence {
  const mu = GM_EARTH;
  const r_phase = EARTH_RADIUS + 350e3;
  const r_iss   = EARTH_RADIUS + 408e3;

  const { dv1, dv2, transferTime } = hohmannTransfer(r_phase, r_iss);

  const T_phase = 2 * Math.PI * Math.sqrt(r_phase ** 3 / mu);
  const T_iss   = 2 * Math.PI * Math.sqrt(r_iss   ** 3 / mu);

  // Angular rate difference (shuttle completes orbits faster)
  const dOmega = 2 * Math.PI / T_phase - 2 * Math.PI / T_iss;

  const numPhasingOrbits = 2;
  const tiBurnTime = numPhasingOrbits * T_phase;   // seconds until TI burn

  // Phase gained by shuttle on ISS over the phasing period
  const phaseGain = dOmega * tiBurnTime;            // radians

  // During the Hohmann half-transfer the ISS moves this angle:
  const issTransferAngle = (2 * Math.PI / T_iss) * transferTime;

  // ISS needs to be (π − issTransferAngle) ahead at TI so it arrives at the
  // apoapsis rendezvous point simultaneously with the shuttle.
  const requiredLeadAtTI = Math.PI - issTransferAngle;
  const phi_iss = requiredLeadAtTI + phaseGain;     // radians

  // ISS initial state: equatorial circular orbit at r_iss, phi_iss ahead of shuttle.
  // Coordinate system: pos=[r,0,0], vel=[0,0,-v] at φ=0, so tangential velocity is
  // [-v·sin(φ), 0, -v·cos(φ)] — note the negative sign on the X component.
  const v_iss = Math.sqrt(mu / r_iss);
  const issInitialState: StateVector = {
    position: [
       r_iss * Math.cos(phi_iss),
      0,
      -r_iss * Math.sin(phi_iss),
    ] as [number, number, number],
    velocity: [
      -v_iss * Math.sin(phi_iss),
      0,
      -v_iss * Math.cos(phi_iss),
    ] as [number, number, number],
  };

  const burnDuration = 30;
  const mccDuration = 20;
  // Center both burns at their orbit nodes. The phase-angle calculation assumes
  // the effective ΔV happens at periapsis (TI) and apoapsis (circ), which
  // corresponds to the midpoint of each finite-duration burn. Starting each
  // burn burnDuration/2 seconds early achieves this alignment.
  const tiBurnStart = tiBurnTime - burnDuration / 2;
  const burnStart2  = tiBurnTime + transferTime - burnDuration / 2;
  const mcc1Start = tiBurnTime + transferTime * 0.35 - mccDuration / 2;
  const mcc2Start = tiBurnTime + transferTime * 0.70 - mccDuration / 2;
  const totalDuration = burnStart2 + burnDuration + T_iss * 1.5;

  return {
    version: 1,
    name: 'ISS Rendezvous & Docking',
    initialState: {
      position: [r_phase, 0, 0],
      velocity: [0, 0, -Math.sqrt(mu / r_phase)],
    },
    issInitialState,
    maneuvers: [
      {
        id: 'TI Burn',
        startTime: tiBurnStart,
        deltaV: [dv1, 0, 0],
        duration: burnDuration,
      },
      {
        id: 'MCC-1',
        startTime: mcc1Start,
        deltaV: [0.25, 0, 0],
        duration: mccDuration,
      },
      {
        id: 'MCC-2',
        startTime: mcc2Start,
        deltaV: [-0.28, 0, 0],
        duration: mccDuration,
      },
      {
        id: 'Circularization',
        startTime: burnStart2,
        deltaV: [dv2, 0, 0],
        duration: burnDuration,
      },
    ],
    totalDuration,
  };
}

/**
 * Bi-Elliptic Transfer — LEO (200 km) → GEO (35,786 km) via a 200,000 km
 * intermediate orbit.  Three burns: TLI at LEO, raise-periapsis at 200 Mm,
 * circularize at GEO.  Demonstrates the sweeping high-apoapsis trajectory.
 */
export function biellipticPreset(): ManeuverSequence {
  const mu  = GM_EARTH;
  const r1   = EARTH_RADIUS + 200e3;
  const r_int = EARTH_RADIUS + 200000e3;
  const r2   = EARTH_RADIUS + 35786e3;

  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);

  // First transfer ellipse: periapsis = r1, apoapsis = r_int
  const a_te1 = (r1 + r_int) / 2;
  const vte1_peri = Math.sqrt(mu * (2 / r1   - 1 / a_te1));
  const vte1_apo  = Math.sqrt(mu * (2 / r_int - 1 / a_te1));

  // Second transfer ellipse: apoapsis = r_int, periapsis = r2
  const a_te2 = (r_int + r2) / 2;
  const vte2_apo  = Math.sqrt(mu * (2 / r_int - 1 / a_te2));
  const vte2_peri = Math.sqrt(mu * (2 / r2   - 1 / a_te2));

  const dv1_bi = vte1_peri - v1;           // prograde at LEO periapsis
  const dv2_bi = vte2_apo  - vte1_apo;    // prograde at intermediate apoapsis
  const dv3_bi = v2        - vte2_peri;   // retrograde at GEO periapsis (negative)

  const t_te1 = Math.PI * Math.sqrt(a_te1 ** 3 / mu);
  const t_te2 = Math.PI * Math.sqrt(a_te2 ** 3 / mu);

  const burnStart1 = 300;
  const burnDur1   = 120;
  const burnStart2 = burnStart1 + t_te1;
  const burnDur2   = 60;
  const burnStart3 = burnStart2 + t_te2;
  const burnDur3   = 60;
  const totalDuration = burnStart3 + burnDur3 + 3600 * 2;

  return {
    version: 1,
    name: 'Bi-Elliptic LEO → GEO via 200 Mm',
    initialState: {
      position: [r1, 0, 0],
      velocity: [0, 0, -v1],
    },
    maneuvers: [
      {
        id: 'TLI Burn',
        startTime: burnStart1,
        deltaV: [dv1_bi, 0, 0],
        duration: burnDur1,
      },
      {
        id: 'Periapsis Raise',
        startTime: burnStart2,
        deltaV: [dv2_bi, 0, 0],
        duration: burnDur2,
      },
      {
        id: 'GEO Insertion',
        startTime: burnStart3,
        deltaV: [dv3_bi, 0, 0],
        duration: burnDur3,
      },
    ],
    totalDuration,
  };
}

/**
 * Reentry Sequence — from ISS altitude (408 km), a retrograde deorbit burn
 * lowers periapsis to ~60 km.  Atmospheric drag then causes the spacecraft
 * to spiral inward and eventually crash.
 */
export function reentryPreset(): ManeuverSequence {
  const mu       = GM_EARTH;
  const r_start  = EARTH_RADIUS + 408e3;
  const r_peri   = EARTH_RADIUS + 60e3;   // periapsis below 70 km crash threshold
  const v_circ   = Math.sqrt(mu / r_start);
  const a_reentry = (r_start + r_peri) / 2;
  const v_at_apo  = Math.sqrt(mu * (2 / r_start - 1 / a_reentry));
  const dv        = v_at_apo - v_circ;    // negative = retrograde

  return {
    version: 1,
    name: 'Reentry from ISS Orbit',
    initialState: {
      position: [r_start, 0, 0],
      velocity: [0, 0, -v_circ],
    },
    maneuvers: [
      {
        id: 'Deorbit Burn',
        startTime: 300,
        deltaV: [dv, 0, 0],
        duration: 30,
      },
    ],
    totalDuration: 300 + 30 + 5000,
  };
}

export function getPreset(name: string): ManeuverSequence | null {
  switch (name) {
    case 'leo-circular':      return leoCircularPreset();
    case 'hohmann-leo-geo':   return hohmannLeoGeoPreset();
    case 'hohmann-leo-meo':   return hohmannLeoMeoPreset();
    case 'orbit-raise':       return orbitRaisePreset();
    case 'orbit-lower':       return orbitLowerPreset();
    case 'iss-rendezvous':    return issRendezvousPreset();
    case 'bielliptic-geo':    return biellipticPreset();
    case 'reentry':           return reentryPreset();
    default: return null;
  }
}
