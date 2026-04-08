/**
 * Artemis II mission phase definitions.
 *
 * Phases are computed relative to the ephemeris start time and
 * the detected lunar flyby epoch.
 */

import { getMoonPositionECI } from '../realtime/celestial-positions';

export interface MissionPhase {
  id: string;
  label: string;
  shortLabel: string;
  startTimeMs: number;
  endTimeMs: number;
  color: string;
  cameraHint: 'earth' | 'orion' | 'moon';
}

export interface EphemerisPoint {
  epoch: number; // Unix ms
  position: [number, number, number]; // meters, ECI Y-up
}

/**
 * Scan ephemeris points to find the epoch of closest lunar approach.
 * Computes distance between each Orion position and the Moon position
 * at that time (via astronomy-engine).
 */
export function findLunarFlybyEpoch(points: EphemerisPoint[]): number {
  let minDist = Infinity;
  let flybyMs = points[0]?.epoch ?? 0;

  // Sample every 10th point for speed (still ~326 samples over 8.5 days)
  for (let i = 0; i < points.length; i += 10) {
    const p = points[i];
    const date = new Date(p.epoch);
    const moonECI = getMoonPositionECI(date);

    const dx = p.position[0] - moonECI[0];
    const dy = p.position[1] - moonECI[1];
    const dz = p.position[2] - moonECI[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < minDist) {
      minDist = dist;
      flybyMs = p.epoch;
    }
  }

  // Refine: scan individual points near the coarse minimum
  const window = 6 * 3600 * 1000; // 6 hours
  for (const p of points) {
    if (Math.abs(p.epoch - flybyMs) > window) continue;
    const date = new Date(p.epoch);
    const moonECI = getMoonPositionECI(date);

    const dx = p.position[0] - moonECI[0];
    const dy = p.position[1] - moonECI[1];
    const dz = p.position[2] - moonECI[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < minDist) {
      minDist = dist;
      flybyMs = p.epoch;
    }
  }

  return flybyMs;
}

/**
 * Build mission phases from ephemeris bounds and flyby epoch.
 */
export function getArtemisPhases(
  epochStartMs: number,
  epochEndMs: number,
  flybyEpochMs: number,
): MissionPhase[] {
  const hour = 3600 * 1000;
  const day = 24 * hour;

  // Phase boundaries (approximate, based on Artemis II flight plan)
  const tliEnd = epochStartMs + 2 * hour;
  const flybyWindowStart = flybyEpochMs - 6 * hour;
  const flybyWindowEnd = flybyEpochMs + 6 * hour;
  const reentryStart = epochEndMs - 12 * hour;

  return [
    {
      id: 'checkout',
      label: 'CHECKOUT & TLI',
      shortLabel: 'TLI',
      startTimeMs: epochStartMs,
      endTimeMs: tliEnd,
      color: '#ff8800',
      cameraHint: 'earth',
    },
    {
      id: 'outbound',
      label: 'OUTBOUND COAST',
      shortLabel: 'OUTBOUND',
      startTimeMs: tliEnd,
      endTimeMs: flybyWindowStart,
      color: '#00bbdd',
      cameraHint: 'earth',
    },
    {
      id: 'flyby',
      label: 'LUNAR FLYBY',
      shortLabel: 'FLYBY',
      startTimeMs: flybyWindowStart,
      endTimeMs: flybyWindowEnd,
      color: '#ffcc00',
      cameraHint: 'moon',
    },
    {
      id: 'return',
      label: 'RETURN COAST',
      shortLabel: 'RETURN',
      startTimeMs: flybyWindowEnd,
      endTimeMs: reentryStart,
      color: '#4488ff',
      cameraHint: 'earth',
    },
    {
      id: 'reentry',
      label: 'ENTRY INTERFACE',
      shortLabel: 'ENTRY',
      startTimeMs: reentryStart,
      endTimeMs: epochEndMs,
      color: '#ff4444',
      cameraHint: 'orion',
    },
  ];
}

/**
 * Find the current mission phase for a given time.
 */
export function getCurrentPhase(phases: MissionPhase[], timeMs: number): MissionPhase | null {
  for (const phase of phases) {
    if (timeMs >= phase.startTimeMs && timeMs < phase.endTimeMs) {
      return phase;
    }
  }
  // If past all phases, return last
  if (phases.length > 0 && timeMs >= phases[phases.length - 1].endTimeMs) {
    return phases[phases.length - 1];
  }
  return phases[0] ?? null;
}
