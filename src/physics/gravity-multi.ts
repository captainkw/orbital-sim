import { GM_EARTH, GM_MOON } from '../constants';

export function gravitationalAccelerationMulti(
  x: number, y: number, z: number,
  moonPos: [number, number, number]
): [number, number, number] {
  // Earth gravity
  const r2 = x * x + y * y + z * z;
  const r = Math.sqrt(r2);
  const r3 = r2 * r;
  const earthFactor = -GM_EARTH / r3;

  // Moon gravity
  const dx = x - moonPos[0];
  const dy = y - moonPos[1];
  const dz = z - moonPos[2];
  const mr2 = dx * dx + dy * dy + dz * dz;
  const mr = Math.sqrt(mr2);
  const mr3 = mr2 * mr;
  const moonFactor = -GM_MOON / mr3;

  return [
    earthFactor * x + moonFactor * dx,
    earthFactor * y + moonFactor * dy,
    earthFactor * z + moonFactor * dz,
  ];
}
