# Claude AI Notes for orbital-sim

This file records lessons learned and project-specific conventions for AI assistants working on this codebase.

---

## Git Workflow — NEVER push directly to `main`

**Rule**: Always create a feature branch and open a PR. Never push commits directly to `main` unless the user explicitly says "push to main directly."

The correct workflow for every change:
1. Create a feature branch: `git checkout -b feature/my-change`
2. Commit changes to the branch
3. Push the branch: `git push -u origin feature/my-change`
4. Open a PR: `gh pr create ...`
5. Let the user review, playtest, and merge the PR themselves

If a mistake is made and a commit lands on `main` directly:
1. Create a feature branch from the current HEAD: `git checkout -b feature/my-change`
2. Push the feature branch: `git push -u origin feature/my-change`
3. Revert `main` with a force push: `git checkout main && git reset --hard <previous-sha> && git push --force origin main`
4. Open a PR from the feature branch

---

## Three.js OrbitControls — Do NOT fight it with manual camera writes

### The mistake

When implementing a "camera reference-frame lock" (camera follows shuttle attitude), previous attempts tried to:
1. Manually write to `camera.position` each frame to place the camera relative to the shuttle.
2. Call `controls.update()` afterward (or before), then try to re-apply the manual position.
3. Clamp or smooth the "jumps" caused by OrbitControls overwriting the manual position.

This always fails. `OrbitControls` maintains its own internal spherical coordinate state (radius, theta, phi). Every call to `controls.update()` recomputes `camera.position` from that internal state, **completely overwriting** any manual writes to `camera.position`. No amount of clamping or `justEntered` flags fixes this — you are fighting two systems that both think they own the camera.

Symptoms of this mistake:
- Camera jumps to a seemingly random zoom level (e.g. 47 km or 51 km) when entering the lock.
- Camera slowly drifts or flies away at high time-warp.
- User mouse input (pan/orbit) stops working when you disable OrbitControls flags.

### The correct approach

**Take full ownership of the camera when in a custom mode. Do not share control with OrbitControls.**

When entering the custom camera mode (e.g. shuttle reference-frame lock):
1. Set `controls.enableRotate = false`, `controls.enablePan = false`, `controls.enableZoom = false`, `controls.enableDamping = false` — disable OrbitControls entirely.
2. **Skip `controls.update()` entirely** while in the custom mode.
3. Attach your own `wheel` and `pointerdown/move/up` event listeners directly to `renderer.domElement` to capture user input and update your own state variables (`distance`, `localOffset`, etc.).
4. Each frame, compute `camera.position` **write-only** from your own state — never read `camera.position` back to infer user intent while locked.
5. On exit from the custom mode, restore all OrbitControls flags, remove your custom listeners, and resume calling `controls.update()`.

### Implementation pattern used in this project

```ts
// Entry
this.sceneManager.controls.enableRotate = false;
this.sceneManager.controls.enablePan = false;
this.sceneManager.controls.enableZoom = false;
this.sceneManager.controls.enableDamping = false;
this.attachRefLockListeners(); // custom wheel + pointer handlers

// Per-frame (in the locked branch only — no controls.update())
applyShuttleReferenceCamera(shuttleTarget); // pure write-only

// Exit
this.detachRefLockListeners();
this.sceneManager.controls.enableRotate = true;
// ... restore other flags ...
this.sceneManager.controls.enableZoom = true;

// In the main loop
if (!this.shuttleRefFrameLock) {
  this.sceneManager.controls.update(); // only called when NOT locked
}
```

The custom wheel handler adjusts `this.shuttleRefDistance` directly. The custom pointer handler rotates `this.shuttleRefLocalOffset` (a unit vector in shuttle-local space). `applyShuttleReferenceCamera` transforms that local offset by the shuttle's world quaternion and sets `camera.position` — it never reads `camera.position`.

---

## Terminology — Perigee / Apogee, not Periapsis / Apoapsis

This simulator is Earth-orbit only. Always use **perigee** and **apogee** in:
- All UI labels (HUD, overlays, dropdowns)
- README and documentation
- Code comments and variable names

Only use the generic terms **periapsis / apoapsis** if the project ever expands to simulate orbits around other bodies (Moon, Mars, etc.). Until then, periapsis/apoapsis are incorrect for this context.

---

## Orbit Line — Use Analytical Ellipse, Not Numerical Prediction

**Rule**: `predictOrbit` must generate the orbit ellipse analytically from Keplerian elements. Never use RK4 steps on a timer for orbit line display.

### Why

The old approach ran 1,200 RK4 steps every 50 ms, then translated the mesh geometry to follow the spacecraft between ticks. Even with per-frame translation, the snap at each prediction tick was visible at close zoom (the translation does not correctly account for orbit curvature). The result was multiple flickering cyan lines at close zoom.

### The correct approach

1. Derive the orbit plane basis directly from the state vector — never from RAAN/AoP angles, which are undefined (and jump frame-to-frame) for near-circular orbits:
   - Plane normal: `h = r × v` (angular momentum)
   - Perigee direction: eccentricity vector `e = ((v²−μ/r)r − (r·v)v) / μ`; fall back to `r̂` when `|e| < 1e-4`
   - Second in-plane axis: `q = ĥ × p̂`
2. Sample 1,200 points at equal true-anomaly intervals **starting from the spacecraft's current true anomaly `ν₀`** so the line is phase-locked and always touches the vessel.
3. Force `points[0]` and `points[N]` (closing vertex) to the exact spacecraft position.
4. Call this every frame — it is pure trig and cheap.
5. For hyperbolic/escape trajectories fall back to a short RK4 numerical propagation.

### What NOT to do

- Do not add a `trackBody()` per-frame mesh translation. If the geometry needs it, the generation is wrong.
- Do not use a timer / `orbitUpdateTimer`. The analytical version is fast enough to run every frame.

---

## Camera Ref-Lock Exit Condition — Use `shuttleRefDistance`, Never Live Distance

**Rule**: The condition to exit the shuttle reference-frame lock must check `this.shuttleRefDistance >= REF_LOCK_EXIT_DIST`, not the live `camera.position.distanceTo(shuttleTarget)`.

### Why

At any warp level above 1x the physics accumulator runs multiple steps per frame. The shuttle can leap tens or hundreds of km in a single frame. After `applyShuttleReferenceCamera` places the camera at `shuttleRefDistance` relative to the *previous* shuttle position, the *next* frame's `getShuttleTarget()` returns a position many km away. Computing `camera.distanceTo(newShuttlePos)` gives a huge number even though the user has not moved the camera at all — this causes the lock to exit spuriously every frame, snapping the camera back to ~25 km.

`shuttleRefDistance` is only modified by explicit user wheel/pinch input, so it correctly represents the user's intended zoom distance regardless of warp.

### What NOT to do

```ts
// WRONG — breaks at warp > 1x
const zoomDist = this.sceneManager.camera.position.distanceTo(shuttleTarget);
if (zoomDist >= REF_LOCK_EXIT_DIST) this.exitRefLock();
```

### Correct pattern

```ts
// CORRECT — only responds to actual user zoom input
if (this.shuttleRefDistance >= REF_LOCK_EXIT_DIST) this.exitRefLock();
```

---

## Mobile Overlays — Use `pointerup`, Not `click`

**Rule**: Any fullscreen overlay `div` that sits on top of the Three.js canvas must listen for `pointerup` (with `e.stopPropagation()`), not `click`.

### Why

On iOS/Android, the Three.js canvas registers pointer handlers on `renderer.domElement`. These handlers can consume a touch before the browser synthesizes a `click` event, so `click` listeners on overlay elements never fire. `pointerup` fires at the raw pointer level, before canvas handlers can steal it.

### Correct pattern

```ts
this.overlay.addEventListener('pointerup', (e) => {
  e.stopPropagation();
  this.dismiss();
});
this.someButton.addEventListener('pointerup', (e) => {
  e.stopPropagation();
  this.onAction?.();
});
```

This applies to: docking overlay, crash overlay, any future modal or toast that overlays the canvas.

---

## Git Terminology — "Committed to Branch and Pushed Branch"

**Rule**: Never say just "pushed". Always say "committed to branch `<name>` and pushed branch" so it is clear that a PR create/merge step is still separate and required.

### Correct phrases

- "Committed to branch `fix/my-fix` and pushed branch."
- "Committed to branch and pushed to existing PR #27."

### Incorrect phrases

- "Pushed." — ambiguous; sounds like the PR was merged.
- "Pushed to PR." — only correct if the branch already had an open PR and you explicitly pushed to that branch.

### When to create a PR

After pushing a branch, always check `gh pr list --state open` to see if a PR already exists for that branch. If not, create one with `gh pr create`. Never assume a push to a branch automatically updates or creates a PR.

---

## General conventions

- Scene units: `1 unit = 1000 km`. The constant `SCALE = 1e-6` converts metres → scene units.
- Physics integrator: RK4 (`rk4Step`) with fixed timestep `PHYSICS_DT`.
- ISS and shuttle are both propagated with the same integrator each physics tick.
- Docking threshold: 500 m distance + 2 m/s relative velocity (`DOCKING_DIST`, `DOCKING_REL_VEL`).
- Model adaptive scaling only applies in shuttle camera-lock mode; keep models at `MODEL_SCALE_FAR` in earth/free modes to avoid apparent shrinking during orbit view.
