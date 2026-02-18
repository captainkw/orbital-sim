import { describe, it, expect } from 'vitest';
import { validateSequence } from '../src/scripting/maneuver-schema';
import { EARTH_RADIUS, GM_EARTH } from '../src/constants';

describe('validateSequence', () => {
  const r = EARTH_RADIUS + 400e3;
  const v = Math.sqrt(GM_EARTH / r);

  const base = {
    version: 1,
    name: 'Test',
    initialState: {
      position: [r, 0, 0],
      velocity: [0, 0, -v],
    },
    maneuvers: [
      {
        id: 'Burn 1',
        startTime: 100,
        duration: 60,
        deltaV: [10, 0, 0],
      },
    ],
    totalDuration: 1000,
  };

  it('accepts a valid sequence', () => {
    expect(validateSequence(base)).not.toBeNull();
  });

  it('rejects NaN values', () => {
    const bad = structuredClone(base);
    bad.maneuvers[0].deltaV = [NaN, 0, 0];
    expect(validateSequence(bad)).toBeNull();
  });

  it('rejects negative durations', () => {
    const bad = structuredClone(base);
    bad.maneuvers[0].duration = -1;
    expect(validateSequence(bad)).toBeNull();
  });

  it('rejects empty names', () => {
    const bad = structuredClone(base);
    bad.name = '';
    expect(validateSequence(bad)).toBeNull();
  });
});
