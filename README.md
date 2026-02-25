# Orbital Simulator

A browser-based orbital mechanics simulator with realistic gravity, physics, Hohmann transfer orbits, atmospheric drag, and crash detection. Fly spacecraft, plan maneuvers, and explore orbital mechanics hands-on.

Play with the [Orbital Sim](https://captainkw.github.io/orbital-sim/) here on mobile or desktop browsers of your choice.

Built with love by **Kuangwei Hwang**, with an assist from Claude.

---

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

## Playing the Simulator

### Circular Orbits

When you first load the simulator, you're placed in a 600 km Low Earth Orbit (LEO). Use the **altitude slider** at the bottom-right (or top-right on mobile) to change your orbital altitude from 100 km all the way up to 50,000 km and watch how orbital velocity, period, and the shape of your orbit change in real time.

### Hohmann Transfers

The real fun starts with transfer orbits. Select any transfer preset from the dropdown and the UI switches to **from/to altitude sliders**, letting you dial in custom transfer parameters:

- **Hohmann LEO to GEO** -- The classic transfer from 200 km to geostationary orbit at 35,786 km. Watch the two burns play out on the timeline: a **Transfer Injection** burn to enter the elliptical transfer orbit, then a **Circularization** burn at apogee to settle into GEO.
- **Hohmann LEO to MEO** -- Transfer to Medium Earth Orbit at 20,200 km (GPS satellite altitude).
- **Orbit Raise 400 to 800 km** -- A short hop between two LEO altitudes. Great for seeing how even small altitude changes require precise burns.
- **Orbit Lower 800 to 400 km** -- The reverse: a **Deorbit Burn** (retrograde) drops the perigee, followed by a **Circularization** burn at the lower altitude.

### ISS Rendezvous & Docking

The **ISS Rendezvous & Docking** preset demonstrates the multi-phase approach used by the Space Shuttle and Soyuz to dock with the International Space Station.

The ISS is placed in a 408 km circular orbit ahead of the shuttle, which starts in a 350 km **phasing orbit**. At 350 km the shuttle completes orbits faster than ISS (shorter period: ~91.4 vs ~92.5 min), so it slowly catches up. After two phasing orbits the geometry is correct for the **Terminal Initiation (TI) burn** — a small prograde impulse that raises the apoapsis to 408 km. The shuttle coasts up the transfer ellipse and meets the ISS at apoapsis, where a **Circularization** burn matches its velocity to the ISS. The HUD shows **DIST** (distance to ISS) and **RVEL** (relative velocity) in real time.

Docking is confirmed when the shuttle closes to within 500 m at under 2 m/s relative velocity.

### Bi-Elliptic Transfer

The **Bi-Elliptic LEO to GEO via 200 Mm** preset shows a three-burn trajectory: the spacecraft swings all the way out to 200,000 km before descending into GEO. It demonstrates the bi-elliptic concept — for sufficiently large orbit-ratio changes (r₂/r₁ > 11.94) this route uses less delta-V than a Hohmann transfer.

### Reentry from ISS Orbit

The **Reentry from ISS Orbit** preset fires a retrograde deorbit burn from 408 km, lowering the periapsis into the upper atmosphere. Watch atmospheric drag take over and the orbit decay until the crash overlay triggers.

Once a transfer preset is loaded, drag the **From** and **To** sliders to experiment with different altitudes. The maneuver sequence regenerates live -- you can see the burn markers shift on the timeline and watch the delta-V requirements change.

### Crashing (and Trying Again)

If your orbit decays below 70 km altitude, atmospheric drag takes over and the spacecraft is destroyed during reentry. The screen flashes **"YOU CRASHED"** with a 60-second countdown -- click anywhere or wait it out to restart from the last preset. This is especially relevant at low altitudes where drag is non-negligible, or if you accidentally thrust retrograde and lower your perigee into the atmosphere.

### Time Warp

The warp slider at the top of the screen lets you speed up time across seven levels, from real-time all the way to **1,000,000x**. At maximum warp, a 5-hour Hohmann transfer to GEO completes in seconds. Use the `,` and `.` keys for fine-grained control.

### Camera Lock

Use the **camera target dropdown** to lock the camera on Earth, the shuttle, or switch to free camera mode. Right-clicking automatically switches to free camera.

---

## Controls

### Desktop

#### Spacecraft

| Key | Action |
|-----|--------|
| Arrow Up/Down | Pitch (nose toward/away from planet) |
| Arrow Left/Right | Yaw left/right |
| W | Thrust forward (prograde) |
| S | Thrust backward (retrograde) |
| A / D | Thrust left/right |
| T | Reset orientation to prograde |

Rotation rate: 1 rad/s in the spacecraft's local frame. Thrust acceleration: 10 m/s^2, transformed from local to ECI frame via the spacecraft's quaternion.

#### Time

| Key | Action |
|-----|--------|
| Space | Pause / Play |
| . (Period) | Increase time warp |
| , (Comma) | Decrease time warp |

Warp levels: 1x, 10x, 100x, 1,000x, 10,000x, 100,000x, 1,000,000x. Also controllable via the slider at the top of the screen.

#### Camera

| Input | Action |
|-------|--------|
| Left click + drag | Orbit around Earth |
| Scroll wheel | Zoom in/out |
| Right click + drag | Pan |

### Mobile

On touch devices, the desktop keyboard help is hidden and two virtual joysticks appear at the bottom of the screen:

- **Left joystick** ("Manual Thrust Control") -- equivalent to WASD keys for thrust
- **Right joystick** ("Manual Pitch / Yaw") -- equivalent to arrow keys for rotation

Camera controls on mobile:

| Gesture | Action |
|---------|--------|
| 1-finger drag | Orbit around Earth |
| 2-finger pinch | Zoom in/out |
| 2-finger drag | Pan |

The altitude/preset controls move to the top-right corner on mobile, and the Import/Export buttons are hidden.

### Presets & Import/Export

| Control | Action |
|---------|--------|
| Preset dropdown | Select a pre-built orbit or transfer |
| Altitude slider | Adjust circular orbit altitude (100--50,000 km) |
| Inclination slider | Tilt the orbit plane (0°--90°) |
| From/To sliders | Adjust transfer orbit departure and arrival altitudes |
| Camera target | Lock camera to Earth, shuttle, or free mode |
| Import JSON | Load a maneuver sequence from file |
| Export JSON | Save the current sequence to file |

---

## Physics

### Gravity

The simulator uses Newtonian point-mass gravity:

```
a = -GM_Earth * r / |r|^3
```

This produces accurate Keplerian orbits -- ellipses, parabolas, and hyperbolas all emerge naturally from the same force law. The gravitational parameter `GM_Earth = 3.986004418 x 10^14 m^3/s^2` comes from the IERS conventions, matching the value used in real mission planning software.

### Atmospheric Drag

Below 600 km altitude, the spacecraft experiences aerodynamic drag using an exponential atmosphere model:

```
F_drag = 0.5 * rho * Cd * A * v^2
```

| Parameter | Value |
|-----------|-------|
| Sea-level density (rho_0) | 1.225 kg/m^3 |
| Scale height | 8,500 m |
| Drag coefficient (Cd) | 2.2 |
| Cross-section area | 10 m^2 |
| Spacecraft mass | 1,000 kg |

Density falls off exponentially with altitude: `rho = rho_0 * exp(-h / H)`. The drag force always opposes the velocity vector. At typical LEO altitudes (200--400 km), drag is small but nonzero -- over many orbits it causes gradual orbital decay. Below 70 km, drag becomes catastrophic and triggers the crash screen.

### Integrator

All physics are advanced with a **4th-order Runge-Kutta (RK4)** integrator at a fixed 1-second timestep. At each step, gravity, drag, and any active thrust are summed into a net acceleration and propagated through the standard k1--k4 stages. The fixed timestep ensures deterministic, reproducible results regardless of frame rate.

At high warp levels, the engine runs up to 10,000 physics steps per frame to keep up with the accelerated clock.

### Hohmann Transfers

Transfer orbit burns are computed analytically using the classical Hohmann transfer formulas:

- Transfer semi-major axis: `a_t = (r1 + r2) / 2`
- Delta-V at departure: `dv1 = sqrt(mu * (2/r1 - 1/a_t)) - sqrt(mu / r1)`
- Delta-V at arrival: `dv2 = sqrt(mu / r2) - sqrt(mu * (2/r2 - 1/a_t))`
- Transfer time: `t = pi * sqrt(a_t^3 / mu)`

For orbit lowering, the burns are applied in reverse as retrograde impulses. Burns are modeled as constant-thrust over 60 seconds rather than instantaneous impulses, which is more representative of real spacecraft propulsion.

### Physical Constants

| Constant | Value | Source |
|----------|-------|--------|
| GM_Earth | 3.986004418 x 10^14 m^3/s^2 | IERS / IAU |
| Earth mean radius | 6.371 x 10^6 m | WGS 84 |
| Circular orbit velocity (600 km) | ~7,558 m/s | Derived: sqrt(GM/r) |
| GEO altitude | 35,786 km | Standard |

---

## HUD Display

The heads-up display (top-left) shows real-time telemetry:

| Field | Description |
|-------|-------------|
| ALT | Altitude above Earth's surface (km) |
| VEL | Orbital velocity (m/s) |
| APO | Apogee altitude (km) |
| PER | Perigee altitude (km) |
| SMA | Semi-major axis (km) |
| ECC | Eccentricity |
| INC | Inclination (degrees) |
| RAAN | Right Ascension of Ascending Node (degrees) |
| AoP | Argument of Perigee (degrees) |
| TA | True Anomaly (degrees) |
| TIME | Simulation elapsed time (HH:MM:SS) |
| WARP | Current time warp multiplier |
| THR | Thrust status (ACTIVE / OFF) |
| DRAG | Atmospheric drag acceleration (m/s^2) |

---

## Maneuver Sequence JSON Schema

Maneuver sequences can be imported/exported as JSON:

```json
{
  "version": 1,
  "name": "My Maneuver Sequence",
  "initialState": {
    "position": [6971000, 0, 0],
    "velocity": [0, 0, -7558]
  },
  "maneuvers": [
    {
      "id": "Transfer Injection",
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
| `initialState.position` | [x, y, z] | Position in meters (ECI, Y-up) |
| `initialState.velocity` | [vx, vy, vz] | Velocity in m/s (ECI, Y-up) |
| `maneuvers[].id` | string | Burn label (shown on timeline) |
| `maneuvers[].startTime` | number | Sim time to begin burn (seconds) |
| `maneuvers[].deltaV` | [prograde, normal, radial] | Delta-V components in m/s |
| `maneuvers[].duration` | number | Burn duration in seconds |
| `totalDuration` | number | Total sequence length in seconds |

During scripted burns, the spacecraft auto-aligns to prograde and thrust is applied as constant acceleration (deltaV / duration) in the prograde/normal/radial frame, transformed to ECI at each timestep.

---

## Architecture

### Coordinate System

- **ECI (Earth-Centered Inertial) with Y-up** (Three.js convention)
- Y axis = north pole, XZ plane = equatorial plane
- Initial position on the equator at `(R_earth + altitude, 0, 0)`
- Initial velocity `(0, 0, -v_circular)` for prograde motion

### Scale

- **Internal physics**: SI units (meters, seconds, m/s)
- **Rendering**: 1 Three.js unit = 1,000 km (`SCALE = 1e-6`)

### Project Structure

```
orbital-sim/
├── index.html               # App shell, HUD, timeline, controls overlay
├── src/
│   ├── main.ts              # Entry point
│   ├── app.ts               # Game loop, fixed-timestep accumulator
│   ├── constants.ts         # Physical constants, scale factor
│   ├── types.ts             # StateVector, OrbitalElements, ManeuverNode, etc.
│   ├── physics/
│   │   ├── gravity.ts       # Newtonian gravity acceleration
│   │   ├── atmosphere.ts    # Exponential drag model
│   │   ├── integrator.ts    # RK4 integrator (gravity + drag + thrust)
│   │   ├── orbital-elements.ts  # State vector → Keplerian elements
│   │   ├── trajectory.ts    # Orbit prediction propagator
│   │   └── maneuver.ts      # Hohmann transfer calculator
│   ├── scene/
│   │   ├── scene-manager.ts # Renderer, camera, OrbitControls
│   │   ├── earth.ts         # Textured sphere
│   │   ├── spacecraft.ts    # Shuttle STL model, orientation, thrust arrow
│   │   ├── orbit-line.ts    # Predicted orbit line
│   │   ├── celestial-sphere.ts  # Stars, sun, moon
│   │   └── lighting.ts      # Directional sunlight + ambient
│   ├── controls/
│   │   ├── input-manager.ts # Keyboard state map + synthetic key injection
│   │   ├── camera-controls.ts  # OrbitControls wrapper
│   │   ├── spacecraft-controls.ts  # Rotation + thrust
│   │   ├── virtual-joystick.ts    # Canvas-based touch joystick
│   │   └── mobile-controls.ts    # Mobile detection, joystick setup
│   ├── ui/
│   │   ├── hud.ts           # Telemetry overlay
│   │   ├── orbital-display.ts  # Orbital elements display
│   │   ├── timeline.ts      # Visual timeline with burn labels
│   │   ├── time-controls.ts # Pause/play, warp slider
│   │   └── crash-overlay.ts # Crash detection and restart
│   └── scripting/
│       ├── maneuver-schema.ts    # JSON validation and serialization
│       ├── maneuver-executor.ts  # Fires burns at scheduled sim times
│       └── presets.ts            # Preset builder + pre-built sequences
├── public/
│   ├── textures/
│   │   └── earth_daymap.jpg # NASA Blue Marble texture
│   └── models/
│       ├── shuttle.glb      # Space Shuttle 3D model
│       └── iss/
│           └── iss.glb      # International Space Station 3D model (NASA)
├── amplify.yml              # AWS Amplify build spec
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| [Three.js](https://threejs.org/) | ^0.182.0 | 3D rendering engine -- WebGL renderer, PerspectiveCamera, SphereGeometry, MeshPhongMaterial, BufferGeometry, Line, ArrowHelper, OrbitControls, TextureLoader, STLLoader, logarithmic depth buffer |
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
   - Used for: eccentricity vector computation, argument of perigee, true anomaly, RAAN from the node vector.

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
   - Used for: the transfer orbit semi-major axis formula `a_t = (r1 + r2) / 2`, and delta-V calculations at perigee and apogee.

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

13. **NASA 3D Resources -- International Space Station (ISS) (A)**. NASA.
    - 3D GLB model of the ISS used as the docking target in the ISS Rendezvous preset.
    - URL: https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/International%20Space%20Station%20(ISS)%20(A)
    - License: Public domain (NASA media are generally not copyrighted).

### Three.js & WebGL

13. **Dirksen, J.** (2018). *Learn Three.js* (3rd ed.). Packt Publishing.
    - Practical reference for Three.js scene setup, PerspectiveCamera, MeshPhongMaterial, BufferGeometry, and OrbitControls.

14. **Three.js Documentation**. https://threejs.org/docs/
    - API reference for all Three.js classes used: WebGLRenderer (with logarithmic depth buffer), SphereGeometry, ConeGeometry, LineBasicMaterial, ArrowHelper, TextureLoader, STLLoader, Quaternion, Matrix4.

---

## License

MIT
