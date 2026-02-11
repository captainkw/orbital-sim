import { EARTH_RADIUS } from '../constants';
import { OrbitalElements, SpacecraftState, WarpLevel } from '../types';
import { dragMagnitude } from '../physics/atmosphere';

export class HUD {
  private el: HTMLElement;

  constructor() {
    this.el = document.getElementById('hud')!;
  }

  update(
    state: SpacecraftState,
    elements: OrbitalElements,
    simTime: number,
    warpLevel: WarpLevel,
    paused: boolean
  ) {
    const [x, y, z] = state.stateVector.position;
    const [vx, vy, vz] = state.stateVector.velocity;
    const r = Math.sqrt(x * x + y * y + z * z);
    const alt = (r - EARTH_RADIUS) / 1000; // km
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    const a = elements.semiMajorAxis;
    const e = elements.eccentricity;
    const apoapsis = e < 1 ? (a * (1 + e) - EARTH_RADIUS) / 1000 : Infinity;
    const periapsis = (a * (1 - e) - EARTH_RADIUS) / 1000;

    const hours = Math.floor(simTime / 3600);
    const mins = Math.floor((simTime % 3600) / 60);
    const secs = Math.floor(simTime % 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const deg = (rad: number) => (rad * 180 / Math.PI).toFixed(1);

    this.el.textContent =
`ALT   ${alt.toFixed(1)} km
VEL   ${speed.toFixed(1)} m/s
APO   ${apoapsis === Infinity ? '∞' : apoapsis.toFixed(1)} km
PER   ${periapsis.toFixed(1)} km
SMA   ${(a / 1000).toFixed(1)} km
ECC   ${e.toFixed(4)}
INC   ${deg(elements.inclination)}°
RAAN  ${deg(elements.raan)}°
AoP   ${deg(elements.argumentOfPeriapsis)}°
TA    ${deg(elements.trueAnomaly)}°
TIME  ${timeStr}
WARP  ${warpLevel}x${paused ? ' [PAUSED]' : ''}
THR   ${state.thrustActive ? 'ACTIVE' : 'OFF'}
DRAG  ${dragMagnitude(x, y, z, vx, vy, vz).toExponential(2)} m/s²`;
  }
}
