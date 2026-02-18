import { ManeuverSequence } from '../types';

/**
 * Validate a ManeuverSequence from imported JSON.
 */
export function validateSequence(data: unknown): ManeuverSequence | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'number' || !Number.isFinite(obj.version)) return null;
  if (typeof obj.name !== 'string' || obj.name.length === 0) return null;
  if (!obj.initialState || typeof obj.initialState !== 'object') return null;
  if (!Array.isArray(obj.maneuvers)) return null;
  if (typeof obj.totalDuration !== 'number' || !Number.isFinite(obj.totalDuration) || obj.totalDuration < 0) return null;

  const init = obj.initialState as Record<string, unknown>;
  if (!Array.isArray(init.position) || init.position.length !== 3) return null;
  if (!Array.isArray(init.velocity) || init.velocity.length !== 3) return null;
  if (!init.position.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  if (!init.velocity.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;

  for (const m of obj.maneuvers) {
    if (!m || typeof m !== 'object') return null;
    const man = m as Record<string, unknown>;
    if (typeof man.id !== 'string' || man.id.length === 0) return null;
    if (typeof man.startTime !== 'number' || !Number.isFinite(man.startTime) || man.startTime < 0) return null;
    if (typeof man.duration !== 'number' || !Number.isFinite(man.duration) || man.duration < 0) return null;
    if (!Array.isArray(man.deltaV) || man.deltaV.length !== 3) return null;
    if (!man.deltaV.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  }

  return data as ManeuverSequence;
}

export function serializeSequence(seq: ManeuverSequence): string {
  return JSON.stringify(seq, null, 2);
}
