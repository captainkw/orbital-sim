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

## General conventions

- Scene units: `1 unit = 1000 km`. The constant `SCALE = 1e-6` converts metres → scene units.
- Physics integrator: RK4 (`rk4Step`) with fixed timestep `PHYSICS_DT`.
- ISS and shuttle are both propagated with the same integrator each physics tick.
- Docking threshold: 500 m distance + 2 m/s relative velocity (`DOCKING_DIST`, `DOCKING_REL_VEL`).
- Model adaptive scaling only applies in shuttle camera-lock mode; keep models at `MODEL_SCALE_FAR` in earth/free modes to avoid apparent shrinking during orbit view.
