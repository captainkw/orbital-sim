# Orbital Simulator

A browser-based orbital mechanics simulator built with Three.js and TypeScript. Features realistic Keplerian physics, manual spacecraft control, scripted maneuver sequences with a visual timeline, and JSON import/export.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm run preview
```

### AWS Amplify Deployment

The project includes an `amplify.yml` build spec. Connect the GitHub repo to AWS Amplify Hosting and it will automatically build and deploy from the `dist/` directory.

---

## Controls

### Spacecraft Rotation

| Key | Action |
|-----|--------|
| Arrow Up | Pitch down (nose toward planet) |
| Arrow Down | Pitch up (nose away from planet) |
| Arrow Left | Yaw left |
| Arrow Right | Yaw right |
| T | Auto-align to prograde (velocity direction) |

Rotation rate: 1 rad/s. Rotation is applied in the spacecraft's local reference frame.

### Spacecraft Thrust

| Key | Action |
|-----|--------|
| W | Thrust forward (prograde / local -Z) |
| S | Thrust backward (retrograde / local +Z) |
| A | Thrust left (local -X) |
| D | Thrust right (local +X) |

Thrust acceleration: 10 m/s^2. Thrust direction is transformed from the spacecraft's local frame to the ECI (Earth-Centered Inertial) frame using the spacecraft's quaternion orientation.

### Time Controls

| Key | Action |
|-----|--------|
| Space | Pause / Play |
| . (Period) | Increase time warp |
| , (Comma) | Decrease time warp |

Warp levels: 1x, 5x, 10x, 50x, 100x, 1000x.

### Camera

Camera is controlled exclusively with the mouse via Three.js OrbitControls:

| Input | Action |
|-------|--------|
| Left click + drag | Orbit around Earth |
| Scroll wheel | Zoom in/out |
| Right click + drag | Pan |

Default view is top-down from the north pole. Camera distance is clamped between 2 and 500 Three.js units (2,000 km to 500,000 km).

### Maneuver Presets & Import/Export

| Control | Action |
|---------|--------|
| Preset dropdown | Select a pre-built maneuver sequence |
| Import JSON | Load a maneuver sequence from a JSON file |
| Export JSON | Save the current maneuver sequence as a JSON file |

Available presets:
- **LEO 200km Circular** -- Spacecraft in a 200 km low Earth orbit with no maneuvers (2 orbital periods).
- **Hohmann LEO to GEO** -- Two-burn Hohmann transfer from 200 km LEO to geostationary orbit (35,786 km). First burn at T+300s (~2,428 m/s prograde), second burn at apoapsis (~1,467 m/s prograde), ~5.3 hour transfer.

---

## HUD Display

The heads-up display (top-left, green monospace) shows real-time telemetry:

| Field | Description |
|-------|-------------|
| ALT | Altitude above Earth's surface (km) |
| VEL | Orbital velocity magnitude (m/s) |
| APO | Apoapsis altitude (km) |
| PER | Periapsis altitude (km) |
| SMA | Semi-major axis (km) |
| ECC | Eccentricity (dimensionless) |
| INC | Inclination (degrees) |
| RAAN | Right Ascension of Ascending Node (degrees) |
| AoP | Argument of Periapsis (degrees) |
| TA | True Anomaly (degrees) |
| TIME | Simulation elapsed time (HH:MM:SS) |
| WARP | Current time warp multiplier |
| THR | Thrust status (ACTIVE / OFF) |

---

## Maneuver Sequence JSON Schema

Maneuver sequences can be imported/exported as JSON files:

```json
{
  "version": 1,
  "name": "My Maneuver Sequence",
  "initialState": {
    "position": [6571000, 0, 0],
    "velocity": [0, 0, -7790]
  },
  "maneuvers": [
    {
      "id": "burn-1",
      "startTime": 300,
      "deltaV": [2428, 0, 0],
      "duration": 60
    }
  ],
  "totalDuration": 25000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Schema version (currently 1) |
| `name` | string | Human-readable sequence name |
| `initialState.position` | [x, y, z] | Initial position in meters (ECI, Y-up) |
| `initialState.velocity` | [vx, vy, vz] | Initial velocity in m/s (ECI, Y-up) |
| `maneuvers[].id` | string | Unique burn identifier |
| `maneuvers[].startTime` | number | Sim time to begin burn (seconds) |
| `maneuvers[].deltaV` | [prograde, normal, radial] | Delta-V components in m/s |
| `maneuvers[].duration` | number | Burn duration in seconds |
| `totalDuration` | number | Total sequence length in seconds |

During scripted burns, the spacecraft auto-aligns to prograde and thrust is applied as constant acceleration (deltaV / duration) in the prograde/normal/radial frame, transformed to ECI at each timestep.

---

## Architecture

### Project Structure

```
orbital-sim/
├── index.html               # App shell with HUD, timeline, controls overlay
├── src/
│   ├── main.ts              # Entry point
│   ├── app.ts               # Game loop orchestrator, fixed-timestep accumulator
│   ├── constants.ts         # Physical constants, scale factor, physics params
│   ├── types.ts             # StateVector, OrbitalElements, ManeuverNode, etc.
│   ├── physics/
│   │   ├── gravity.ts       # Newtonian gravity: a = -GM * r / |r|^3
│   │   ├── integrator.ts    # 4th-order Runge-Kutta integrator
│   │   ├── orbital-elements.ts  # State vector to Keplerian elements (Y-up)
│   │   ├── trajectory.ts    # Orbit prediction (propagate without thrust)
│   │   └── maneuver.ts      # Hohmann transfer calculator
│   ├── scene/
│   │   ├── scene-manager.ts # Renderer, camera, OrbitControls, starfield
│   │   ├── earth.ts         # Textured sphere at origin
│   │   ├── spacecraft.ts    # Cone mesh, quaternion orientation, thrust arrow
│   │   ├── orbit-line.ts    # Dynamic BufferGeometry line for orbit prediction
│   │   └── lighting.ts      # Directional sunlight + ambient
│   ├── controls/
│   │   ├── input-manager.ts # Keyboard state map with preventDefault
│   │   ├── camera-controls.ts  # OrbitControls wrapper (mouse only)
│   │   └── spacecraft-controls.ts  # Keyboard rotation + thrust
│   ├── ui/
│   │   ├── hud.ts           # Telemetry overlay
│   │   ├── timeline.ts      # Visual maneuver timeline bar
│   │   ├── time-controls.ts # Pause/play, warp level control
│   │   └── orbital-display.ts  # (placeholder for future expansion)
│   └── scripting/
│       ├── maneuver-schema.ts    # JSON validation and serialization
│       ├── maneuver-executor.ts  # Fires burns at scheduled sim times
│       └── presets.ts            # Pre-built maneuver sequences
├── public/textures/
│   └── earth_daymap.jpg     # NASA Blue Marble Earth texture
├── amplify.yml              # AWS Amplify build spec
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Coordinate System

- **ECI (Earth-Centered Inertial) with Y-up** (Three.js convention)
- **Y axis** = north pole
- **XZ plane** = equatorial plane
- Launch/initial position at `(EARTH_RADIUS + 200km, 0, 0)` on the equator
- Initial velocity `(0, 0, -v_circular)` for a prograde circular orbit

### Scale

- **Internal physics**: SI units (meters, seconds, m/s)
- **Rendering**: 1 Three.js unit = 1,000 km (scale factor `SCALE = 1e-6`)
- Earth radius renders as ~6.371 units, keeping coordinates in float32-friendly range

### Physics Engine

- **Gravity**: Point-mass Newtonian gravity, `a = -GM_Earth * r / |r|^3`
- **Integrator**: Classical 4th-order Runge-Kutta (RK4), fixed 1-second timestep
- **State vector**: 6 elements `[x, y, z, vx, vy, vz]` in SI units
- **Game loop**: Fixed-timestep accumulator with max 1000 steps/frame to prevent spiral-of-death at high warp
- **Orbit prediction**: Propagates the current state forward ~1.1 orbital periods with no thrust, auto-tunes step size from the vis-viva derived period

### Physical Constants

| Constant | Value | Source |
|----------|-------|--------|
| GM_Earth (standard gravitational parameter) | 3.986004418 x 10^14 m^3/s^2 | IERS / IAU |
| Earth mean radius | 6.371 x 10^6 m | WGS 84 mean |
| Circular orbit velocity (200 km) | ~7,784 m/s | Derived: sqrt(GM/r) |
| GEO altitude | 35,786 km | Standard |

---

## Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| [Three.js](https://threejs.org/) | ^0.182.0 | 3D rendering engine -- WebGL renderer, PerspectiveCamera, SphereGeometry, MeshPhongMaterial, BufferGeometry, Line, ArrowHelper, OrbitControls, TextureLoader, logarithmic depth buffer |
| [@types/three](https://www.npmjs.com/package/@types/three) | ^0.182.0 | TypeScript type definitions for Three.js |
| [TypeScript](https://www.typescriptlang.org/) | ^5.9.3 | Static type checking (ES2022 target, strict mode, bundler module resolution) |
| [Vite](https://vite.dev/) | ^7.3.1 | Build tool and dev server -- HMR, ES module bundling, Rollup-based production builds |

---

## Scientific References & Sources

### Orbital Mechanics

1. **Bate, R. R., Mueller, D. D., & White, J. E.** (1971). *Fundamentals of Astrodynamics*. Dover Publications.
   - Core reference for Keplerian orbital elements, the vis-viva equation, and Hohmann transfer orbits.
   - Used for: state vector to orbital elements conversion, orbit period calculation, transfer orbit delta-V formulas.

2. **Curtis, H. D.** (2014). *Orbital Mechanics for Engineering Students* (3rd ed.). Butterworth-Heinemann.
   - Detailed derivations of the classical orbital elements from state vectors.
   - Used for: eccentricity vector computation, argument of periapsis, true anomaly, RAAN from the node vector.

3. **Vallado, D. A.** (2013). *Fundamentals of Astrodynamics and Applications* (4th ed.). Microcosm Press.
   - Comprehensive astrodynamics reference covering coordinate frames, orbital element conversions, and numerical propagation.
   - Used for: ECI coordinate system conventions, gravitational acceleration formulas, RK4 integration approach.

### Numerical Methods

4. **Press, W. H., Teukolsky, S. A., Vetterling, W. T., & Flannery, B. P.** (2007). *Numerical Recipes: The Art of Scientific Computing* (3rd ed.). Cambridge University Press.
   - Standard reference for the 4th-order Runge-Kutta method (Section 17.1).
   - Used for: RK4 integrator implementation with k1-k4 coefficients and weighted average.

5. **Hairer, E., Norsett, S. P., & Wanner, G.** (1993). *Solving Ordinary Differential Equations I: Nonstiff Problems* (2nd ed.). Springer.
   - Theoretical foundation for fixed-step explicit Runge-Kutta methods and error analysis.
   - Used for: understanding the 4th-order accuracy and stability characteristics of the integrator.

### Hohmann Transfer Orbits

6. **Hohmann, W.** (1925). *Die Erreichbarkeit der Himmelskörper* (The Attainability of Heavenly Bodies). Oldenbourg.
   - Original publication describing the minimum-energy two-impulse transfer between coplanar circular orbits.
   - Used for: the transfer orbit semi-major axis formula `a_t = (r1 + r2) / 2`, and delta-V calculations at periapsis and apoapsis.

### Gravitational Parameters & Earth Constants

7. **IERS Conventions (2010)**. Petit, G. & Luzum, B. (eds.). IERS Technical Note No. 36.
   - Source for the geocentric gravitational constant GM_Earth = 3.986004418 x 10^14 m^3/s^2.
   - URL: https://www.iers.org/IERS/EN/Publications/TechnicalNotes/tn36.html

8. **National Imagery and Mapping Agency (NIMA)** (2000). *Department of Defense World Geodetic System 1984* (WGS 84). Technical Report TR8350.2 (3rd ed.).
   - Source for Earth's mean radius (6,371 km) and the WGS 84 reference ellipsoid parameters.

9. **IAU 2009 System of Astronomical Constants**. *IAU 2009 Resolution B2*.
   - Defines the standard gravitational parameter and Earth equatorial radius used in astrodynamics.

### Coordinate Systems

10. **Seidelmann, P. K. (ed.)** (1992). *Explanatory Supplement to the Astronomical Almanac*. University Science Books.
    - Reference for the Earth-Centered Inertial (ECI) coordinate frame definition and its relationship to celestial reference frames.
    - Used for: adapting the standard Z-up ECI frame to Three.js Y-up convention (Y = north pole, XZ = equatorial plane).

### Keplerian Elements

11. **Battin, R. H.** (1999). *An Introduction to the Mathematics and Methods of Astrodynamics* (Revised ed.). AIAA Education Series.
    - Rigorous mathematical treatment of the classical orbital elements and the two-body problem.
    - Used for: the eccentricity vector formula `e = ((v^2 - mu/r) * r - (r . v) * v) / mu`, specific angular momentum, and edge cases for circular/equatorial orbits.

### Earth Textures

12. **NASA Visible Earth -- Blue Marble: Next Generation**. NASA Earth Observatory.
    - Source imagery for the Earth daymap texture used in the simulator.
    - URL: https://visibleearth.nasa.gov/collection/1484/blue-marble
    - License: Public domain (NASA media are generally not copyrighted).

### Three.js & WebGL

13. **Dirksen, J.** (2018). *Learn Three.js* (3rd ed.). Packt Publishing.
    - Practical reference for Three.js scene setup, PerspectiveCamera, MeshPhongMaterial, BufferGeometry, and OrbitControls.

14. **Three.js Documentation**. https://threejs.org/docs/
    - API reference for all Three.js classes used: WebGLRenderer (with logarithmic depth buffer), SphereGeometry, ConeGeometry, LineBasicMaterial, ArrowHelper, TextureLoader, Quaternion, Matrix4.

---

## License

MIT
