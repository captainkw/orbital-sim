import { ManeuverSequence } from '../types';

/**
 * Validate a ManeuverSequence from imported JSON.
 */
export function validateSequence(data: unknown): ManeuverSequence | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'number' || typeof obj.name !== 'string') return null;
  if (!obj.initialState || typeof obj.initialState !== 'object') return null;
  if (!Array.isArray(obj.maneuvers)) return null;
  if (typeof obj.totalDuration !== 'number') return null;

  const init = obj.initialState as Record<string, unknown>;
  if (!Array.isArray(init.position) || init.position.length !== 3) return null;
  if (!Array.isArray(init.velocity) || init.velocity.length !== 3) return null;

  for (const m of obj.maneuvers) {
    if (!m.id || typeof m.startTime !== 'number' || typeof m.duration !== 'number') return null;
    if (!Array.isArray(m.deltaV) || m.deltaV.length !== 3) return null;
  }

  return data as ManeuverSequence;
}

export function serializeSequence(seq: ManeuverSequence): string {
  return JSON.stringify(seq, null, 2);
}
