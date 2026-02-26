// Gravitational parameter of Earth (m^3/s^2)
export const GM_EARTH = 3.986004418e14;

// Earth mean radius (meters)
export const EARTH_RADIUS = 6.371e6;

// Scale factor: multiply meters by SCALE to get Three.js units
// 1 Three.js unit = 1,000 km
export const SCALE = 1e-6;

// Physics fixed timestep (seconds)
export const PHYSICS_DT = 1.0;

// Max physics steps per frame (prevents runaway at high warp)
export const MAX_STEPS_PER_FRAME = 10000;

// Spacecraft masses (kg) — used to scale thrust acceleration when docked
export const SHUTTLE_MASS = 110_000;   // ~110 t (Space Shuttle orbiter dry + propellant)
export const ISS_MASS     = 420_000;   // ~420 t (International Space Station)

// Default spacecraft thrust force (N) — gives ~10 m/s² on the shuttle alone
export const THRUST_FORCE = SHUTTLE_MASS * 10.0;

// Default spacecraft thrust acceleration (m/s^2) — undocked baseline
export const THRUST_ACCEL = 10.0;

// Rotation rate for pitch/yaw (rad/s)
export const ROTATION_RATE = 1.0;
