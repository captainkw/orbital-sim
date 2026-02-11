export interface StateVector {
  position: [number, number, number]; // meters (ECI, Y-up)
  velocity: [number, number, number]; // m/s
}

export interface OrbitalElements {
  semiMajorAxis: number;      // meters
  eccentricity: number;
  inclination: number;        // radians
  raan: number;               // right ascension of ascending node (radians)
  argumentOfPeriapsis: number; // radians
  trueAnomaly: number;        // radians
}

export interface ManeuverNode {
  id: string;
  startTime: number;          // sim time in seconds
  deltaV: [number, number, number]; // [prograde, normal, radial] m/s
  duration: number;           // seconds
}

export interface ManeuverSequence {
  version: number;
  name: string;
  initialState: StateVector;
  maneuvers: ManeuverNode[];
  totalDuration: number;      // total sequence duration in seconds
}

export interface SpacecraftState {
  stateVector: StateVector;
  quaternion: [number, number, number, number]; // x, y, z, w
  thrustActive: boolean;
  thrustDirection: [number, number, number]; // ECI thrust vector (m/s^2)
}

export type WarpLevel = 1 | 5 | 10 | 50 | 100 | 1000;

export const WARP_LEVELS: WarpLevel[] = [1, 5, 10, 50, 100, 1000];
