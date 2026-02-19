import { EARTH_RADIUS, GM_EARTH, MAX_STEPS_PER_FRAME, PHYSICS_DT, SCALE } from './constants';
import { ManeuverSequence, SpacecraftState, StateVector } from './types';
import * as THREE from 'three';

function applyInclination(state: StateVector, incDeg: number): StateVector {
  const inc = incDeg * Math.PI / 180;
  const cosI = Math.cos(inc), sinI = Math.sin(inc);
  const [px, py, pz] = state.position;
  const [vx, vy, vz] = state.velocity;
  return {
    position: [px, py * cosI - pz * sinI, py * sinI + pz * cosI],
    velocity: [vx, vy * cosI - vz * sinI, vy * sinI + vz * cosI],
  };
}
import { SceneManager } from './scene/scene-manager';
import { Earth } from './scene/earth';
import { SpacecraftMesh } from './scene/spacecraft';
import { OrbitLine } from './scene/orbit-line';
import { setupLighting } from './scene/lighting';
import { CelestialSphere } from './scene/celestial-sphere';
import { rk4Step } from './physics/integrator';
import { stateToElements } from './physics/orbital-elements';
import { predictOrbit } from './physics/trajectory';
import { InputManager } from './controls/input-manager';
import { SpacecraftControls } from './controls/spacecraft-controls';
import { MobileControls } from './controls/mobile-controls';
import { HUD } from './ui/hud';
import { TimeControls } from './ui/time-controls';
import { Timeline } from './ui/timeline';
import { CrashOverlay } from './ui/crash-overlay';
import { ManeuverExecutor } from './scripting/maneuver-executor';
import { getPreset, buildHohmannPreset } from './scripting/presets';
import { validateSequence, serializeSequence } from './scripting/maneuver-schema';

export class App {
  private sceneManager: SceneManager;
  private earth: Earth;
  private spacecraftMesh: SpacecraftMesh;
  private orbitLine: OrbitLine;
  private celestialSphere: CelestialSphere;
  private inputManager: InputManager;
  private spacecraftControls: SpacecraftControls;
  private hud: HUD;
  private timeControls: TimeControls;
  private timeline: Timeline;
  private maneuverExecutor: ManeuverExecutor;
  private crashOverlay: CrashOverlay;

  private state: SpacecraftState;
  private simTime = 0;
  private accumulator = 0;
  private lastFrameTime = 0;
  private orbitUpdateTimer = 0;
  private currentSequence: ManeuverSequence | null = null;
  private crashed = false;
  private lastPresetName = 'leo-circular';
  private cameraLockTarget: 'earth' | 'shuttle' | 'free' = 'earth';
  private cameraTransition: {
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
  } | null = null;
  private shuttleCameraDistance = 2000 * 1000 * SCALE;
  private lastShuttleTarget: THREE.Vector3 | null = null;

  constructor() {
    // Scene
    this.sceneManager = new SceneManager();
    this.earth = new Earth();
    this.earth.addTo(this.sceneManager.scene);

    const sunLight = setupLighting(this.sceneManager.scene);

    this.spacecraftMesh = new SpacecraftMesh();
    this.spacecraftMesh.addTo(this.sceneManager.scene);

    this.orbitLine = new OrbitLine();
    this.orbitLine.addTo(this.sceneManager.scene);

    // Celestial sphere (stars, sun, moon)
    this.celestialSphere = new CelestialSphere(this.sceneManager.scene, sunLight);

    // Controls
    this.inputManager = new InputManager();
    this.spacecraftControls = new SpacecraftControls(this.inputManager);
    this.timeControls = new TimeControls(this.inputManager);
    new MobileControls(this.inputManager);

    // UI
    this.hud = new HUD();
    this.timeline = new Timeline();
    this.maneuverExecutor = new ManeuverExecutor();

    // Crash overlay
    this.crashOverlay = new CrashOverlay();
    this.crashOverlay.setRestartCallback(() => {
      this.crashed = false;
      const seq = getPreset(this.lastPresetName);
      if (seq) this.loadSequence(seq);
    });

    // Initial spacecraft state: 600km LEO, equatorial, circular
    const r = EARTH_RADIUS + 600e3;
    const vCircular = Math.sqrt(GM_EARTH / r);
    this.state = {
      stateVector: {
        position: [r, 0, 0],
        velocity: [0, 0, -vCircular],
      },
      quaternion: [0, 0, 0, 1],
      thrustActive: false,
      thrustDirection: [0, 0, 0],
    };

    // Setup UI bindings
    this.setupUIBindings();

    // Load default preset
    this.loadSequence(getPreset('leo-circular')!);
  }

  private setupUIBindings() {
    const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;

    // Circular slider elements
    const circularDiv = document.getElementById('slider-circular') as HTMLDivElement;
    const altSlider = document.getElementById('altitude-slider') as HTMLInputElement;
    const altInput = document.getElementById('altitude-input') as HTMLInputElement;

    // Transfer slider elements
    const transferDiv = document.getElementById('slider-transfer') as HTMLDivElement;
    const fromSlider = document.getElementById('from-slider') as HTMLInputElement;
    const fromInput = document.getElementById('from-input') as HTMLInputElement;
    const toSlider = document.getElementById('to-slider') as HTMLInputElement;
    const toInput = document.getElementById('to-input') as HTMLInputElement;

    // Inclination slider elements
    const incSlider = document.getElementById('inc-slider') as HTMLInputElement;
    const incInput = document.getElementById('inc-input') as HTMLInputElement;

    const getInclination = () => Number(incInput.value);

    const transferPresets = new Set(['hohmann-leo-geo', 'hohmann-leo-meo', 'orbit-raise', 'orbit-lower']);

    const showCircularSliders = (altKm?: number) => {
      circularDiv.style.display = 'flex';
      transferDiv.style.display = 'none';
      if (altKm !== undefined) {
        const clamped = Math.min(50000, Math.max(100, altKm));
        altSlider.value = String(clamped);
        altInput.value = String(clamped);
      }
    };

    const showTransferSliders = (fromKm: number, toKm: number) => {
      circularDiv.style.display = 'none';
      transferDiv.style.display = 'flex';
      fromSlider.value = String(fromKm);
      fromInput.value = String(fromKm);
      toSlider.value = String(toKm);
      toInput.value = String(toKm);
    };

    // Default altitudes for each transfer preset
    const transferDefaults: Record<string, [number, number]> = {
      'hohmann-leo-geo': [200, 35786],
      'hohmann-leo-meo': [200, 20200],
      'orbit-raise': [400, 800],
      'orbit-lower': [800, 400],
    };

    // Preset selector
    presetSelect.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      if (!val) return;
      this.lastPresetName = val;
      const seq = getPreset(val);
      if (seq) {
        seq.initialState = applyInclination(seq.initialState, getInclination());
        this.loadSequence(seq);
        if (transferPresets.has(val)) {
          const [from, to] = transferDefaults[val];
          showTransferSliders(from, to);
        } else {
          const r = Math.sqrt(
            seq.initialState.position[0] ** 2 +
            seq.initialState.position[1] ** 2 +
            seq.initialState.position[2] ** 2
          );
          const altKm = Math.round((r - EARTH_RADIUS) / 1000);
          showCircularSliders(altKm);
        }
      }
    });

    // Circular altitude slider / input → create circular orbit
    const applyAltitude = (altKm: number) => {
      altKm = Math.max(100, Math.min(50000, altKm));
      const r = EARTH_RADIUS + altKm * 1000;
      const v = Math.sqrt(GM_EARTH / r);
      const period = 2 * Math.PI * Math.sqrt(r ** 3 / GM_EARTH);
      const seq: ManeuverSequence = {
        version: 1,
        name: `Circular ${altKm}km`,
        initialState: applyInclination({
          position: [r, 0, 0],
          velocity: [0, 0, -v],
        }, getInclination()),
        maneuvers: [],
        totalDuration: period * 2,
      };
      this.loadSequence(seq);
      presetSelect.value = '';
    };

    altSlider.addEventListener('input', () => {
      altInput.value = altSlider.value;
      applyAltitude(Number(altSlider.value));
    });

    altInput.addEventListener('change', () => {
      const val = Math.max(100, Math.min(50000, Number(altInput.value)));
      altInput.value = String(val);
      altSlider.value = String(val);
      applyAltitude(val);
    });

    // Transfer slider handlers → rebuild Hohmann preset
    const applyTransfer = () => {
      const fromKm = Math.max(100, Math.min(50000, Number(fromInput.value)));
      const toKm = Math.max(100, Math.min(50000, Number(toInput.value)));
      if (fromKm === toKm) return;
      const name = fromKm < toKm
        ? `Hohmann ${fromKm}→${toKm}km`
        : `Hohmann ${fromKm}→${toKm}km`;
      const seq = buildHohmannPreset(name, fromKm, toKm);
      seq.initialState = applyInclination(seq.initialState, getInclination());
      this.loadSequence(seq);
      presetSelect.value = '';
    };

    fromSlider.addEventListener('input', () => {
      fromInput.value = fromSlider.value;
      applyTransfer();
    });
    fromInput.addEventListener('change', () => {
      const val = Math.max(100, Math.min(50000, Number(fromInput.value)));
      fromInput.value = String(val);
      fromSlider.value = String(val);
      applyTransfer();
    });
    toSlider.addEventListener('input', () => {
      toInput.value = toSlider.value;
      applyTransfer();
    });
    toInput.addEventListener('change', () => {
      const val = Math.max(100, Math.min(50000, Number(toInput.value)));
      toInput.value = String(val);
      toSlider.value = String(val);
      applyTransfer();
    });

    // Inclination slider/input → re-apply current orbit with new inclination
    const reapplyWithInclination = () => {
      if (transferDiv.style.display !== 'none') {
        applyTransfer();
      } else {
        applyAltitude(Number(altInput.value));
      }
    };

    incSlider.addEventListener('input', () => {
      incInput.value = incSlider.value;
      reapplyWithInclination();
    });
    incInput.addEventListener('change', () => {
      const val = Math.max(0, Math.min(90, Number(incInput.value)));
      incInput.value = String(val);
      incSlider.value = String(val);
      reapplyWithInclination();
    });

    // Import
    document.getElementById('btn-import')!.addEventListener('click', () => {
      document.getElementById('file-input')!.click();
    });
    document.getElementById('file-input')!.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          const seq = validateSequence(data);
          if (seq) {
            this.loadSequence(seq);
          } else {
            alert('Invalid maneuver sequence JSON');
          }
        } catch {
          alert('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    });

    // Camera target lock
    const cameraTargetSelect = document.getElementById('camera-target') as HTMLSelectElement;
    const recenterShuttleBtn = document.getElementById('btn-recenter-shuttle') as HTMLButtonElement;
    const updateRecenterVisibility = () => {
      recenterShuttleBtn.style.display = this.cameraLockTarget === 'shuttle' ? 'inline-block' : 'none';
    };
    cameraTargetSelect.addEventListener('change', () => {
      const previousTarget = this.cameraLockTarget;
      const nextTarget = cameraTargetSelect.value as 'earth' | 'shuttle' | 'free';
      this.cameraLockTarget = nextTarget;

      if (previousTarget === 'earth' && nextTarget === 'shuttle') {
        this.startEarthToShuttleTransition();
      } else if (nextTarget === 'earth' && previousTarget !== 'earth') {
        this.startEarthRecenterTransition(1.1);
      } else {
        this.cameraTransition = null;
        this.lastShuttleTarget = null;
      }
      updateRecenterVisibility();
    });
    recenterShuttleBtn.addEventListener('click', () => {
      if (this.cameraLockTarget !== 'shuttle') return;
      this.startShuttleRecenterTransition(0.7);
    });
    updateRecenterVisibility();
    this.sceneManager.renderer.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this.cameraLockTarget = 'free';
        this.cameraTransition = null;
        this.lastShuttleTarget = null;
        cameraTargetSelect.value = 'free';
        updateRecenterVisibility();
      }
    });

    // Export
    document.getElementById('btn-export')!.addEventListener('click', () => {
      if (!this.currentSequence) {
        alert('No sequence loaded');
        return;
      }
      const json = serializeSequence(this.currentSequence);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentSequence.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  loadSequence(seq: ManeuverSequence) {
    this.currentSequence = seq;

    // Reset state
    this.state.stateVector = {
      position: [...seq.initialState.position],
      velocity: [...seq.initialState.velocity],
    };
    this.simTime = 0;
    this.accumulator = 0;
    this.crashed = false;
    this.crashOverlay.hide();

    this.spacecraftControls.resetOrientation();
    this.maneuverExecutor.loadSequence(seq);
    this.timeline.loadSequence(seq);
  }

  start() {
    this.lastFrameTime = performance.now() / 1000;
    this.loop();
  }

  private startEarthToShuttleTransition() {
    this.startShuttleRecenterTransition(1.1);
  }

  private startEarthRecenterTransition(duration: number) {
    const currentPos = this.sceneManager.camera.position.clone();
    const currentTarget = this.sceneManager.controls.target.clone();
    const earthPose = this.getEarthCameraPose();

    this.cameraTransition = {
      startTime: performance.now() / 1000,
      duration,
      startPos: currentPos,
      endPos: earthPose.position,
      startTarget: currentTarget,
      endTarget: earthPose.target,
    };
    this.lastShuttleTarget = null;
  }

  private startShuttleRecenterTransition(duration: number) {
    const currentPos = this.sceneManager.camera.position.clone();
    const currentTarget = this.sceneManager.controls.target.clone();
    const shuttlePose = this.getShuttleCameraPose(2000 * 1000 * SCALE);

    this.cameraTransition = {
      startTime: performance.now() / 1000,
      duration,
      startPos: currentPos,
      endPos: shuttlePose.position,
      startTarget: currentTarget,
      endTarget: shuttlePose.target,
    };
    this.shuttleCameraDistance = shuttlePose.position.distanceTo(shuttlePose.target);
    this.lastShuttleTarget = null;
  }

  private getShuttleTarget(): THREE.Vector3 {
    const p = this.state.stateVector.position;
    return new THREE.Vector3(p[0] * SCALE, p[1] * SCALE, p[2] * SCALE);
  }

  private getEarthCameraPose(): { position: THREE.Vector3; target: THREE.Vector3 } {
    const target = new THREE.Vector3(0, 0, 0);
    const [x, y, z] = this.state.stateVector.position;
    const [vx, vy, vz] = this.state.stateVector.velocity;
    const rVec = new THREE.Vector3(x, y, z);
    const vVec = new THREE.Vector3(vx, vy, vz);

    // 90-degree viewpoint relative to the orbit plane.
    let orbitNormal = new THREE.Vector3().crossVectors(rVec, vVec);
    if (orbitNormal.lengthSq() < 1e-12) {
      orbitNormal = new THREE.Vector3(0, 1, 0);
    } else {
      orbitNormal.normalize();
    }

    const elements = stateToElements(this.state.stateVector);
    const currentRadius = rVec.length();
    let orbitRadiusMeters = currentRadius;
    if (Number.isFinite(elements.semiMajorAxis) && elements.eccentricity < 1) {
      const apoapsis = elements.semiMajorAxis * (1 + elements.eccentricity);
      if (Number.isFinite(apoapsis) && apoapsis > 0) {
        orbitRadiusMeters = Math.max(orbitRadiusMeters, apoapsis);
      }
    }
    orbitRadiusMeters = Math.max(orbitRadiusMeters, EARTH_RADIUS);

    const orbitRadiusSceneUnits = orbitRadiusMeters * SCALE;
    const fovRad = THREE.MathUtils.degToRad(this.sceneManager.camera.fov);
    const fitDistance = orbitRadiusSceneUnits / Math.tan(fovRad / 2);
    const distance = fitDistance * 1.25;
    const position = orbitNormal.multiplyScalar(distance);

    return { position, target };
  }

  private getShuttleCameraPose(distance = this.shuttleCameraDistance): { position: THREE.Vector3; target: THREE.Vector3 } {
    const target = this.getShuttleTarget();

    const [qx, qy, qz, qw] = this.state.quaternion;
    const shuttleQuat = new THREE.Quaternion(qx, qy, qz, qw);

    // Local spacecraft axes in world space:
    // +Z is treated as forward/prograde in control space, so -Z is behind.
    const behind = new THREE.Vector3(0, 0, -1).applyQuaternion(shuttleQuat).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(shuttleQuat).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shuttleQuat).normalize();

    const viewDirection = behind.clone()
      .addScaledVector(up, 0.55)
      .addScaledVector(right, 0.55)
      .normalize();
    const position = target.clone().addScaledVector(viewDirection, distance);

    return { position, target };
  }

  private loop = () => {
    requestAnimationFrame(this.loop);

    const now = performance.now() / 1000;
    const frameDt = Math.min(now - this.lastFrameTime, 0.1);
    this.lastFrameTime = now;

    // Time controls
    this.timeControls.update();

    if (!this.timeControls.paused && !this.crashed) {
      // Spacecraft keyboard controls (rotation uses frame dt)
      const manualThrust = this.spacecraftControls.update(this.state, frameDt);

      // Physics accumulator
      this.accumulator += frameDt * this.timeControls.warpLevel;
      let steps = 0;

      while (this.accumulator >= PHYSICS_DT && steps < MAX_STEPS_PER_FRAME) {
        // Get thrust: scripted maneuver overrides manual if active
        let thrust: [number, number, number];
        const scriptedThrust = this.maneuverExecutor.getThrustAtTime(
          this.simTime, this.state
        );

        if (this.maneuverExecutor.isActive) {
          thrust = scriptedThrust;
        } else {
          thrust = manualThrust;
        }

        // RK4 step
        const s = this.state.stateVector;
        const newState = rk4Step(
          [s.position[0], s.position[1], s.position[2],
           s.velocity[0], s.velocity[1], s.velocity[2]],
          PHYSICS_DT,
          thrust
        );

        s.position = [newState[0], newState[1], newState[2]];
        s.velocity = [newState[3], newState[4], newState[5]];

        this.simTime += PHYSICS_DT;
        this.accumulator -= PHYSICS_DT;
        steps++;

        // Check crash after each physics step
        const r = Math.sqrt(s.position[0] ** 2 + s.position[1] ** 2 + s.position[2] ** 2);
        const altitude = r - EARTH_RADIUS;
        if (this.crashOverlay.checkCrash(altitude)) {
          this.crashed = true;
          this.crashOverlay.show();
          break;
        }
      }
    }

    // Update orbit prediction periodically
    this.orbitUpdateTimer += frameDt;
    if (this.orbitUpdateTimer > 0.5) {
      this.orbitUpdateTimer = 0;
      const predicted = predictOrbit(this.state.stateVector);
      this.orbitLine.updateFromPositions(predicted);
    }

    // Update celestial sphere
    this.celestialSphere.update(this.simTime, 172);

    // Update visuals
    this.spacecraftMesh.updateFromState(this.state);

    // Update HUD
    const elements = stateToElements(this.state.stateVector);
    this.hud.update(
      this.state,
      elements,
      this.simTime,
      this.timeControls.warpLevel,
      this.timeControls.paused
    );

    // Update timeline
    this.timeline.updatePlayhead(this.simTime);

    // Camera lock target / transition
    if (this.cameraLockTarget === 'earth') {
      const nowSeconds = performance.now() / 1000;
      const earthPose = this.getEarthCameraPose();
      if (this.cameraTransition) {
        const tRaw = (nowSeconds - this.cameraTransition.startTime) / this.cameraTransition.duration;
        const t = Math.max(0, Math.min(1, tRaw));
        const smoothT = t * t * (3 - 2 * t);
        this.sceneManager.camera.position.lerpVectors(
          this.cameraTransition.startPos,
          earthPose.position,
          smoothT
        );
        this.sceneManager.controls.target.lerpVectors(
          this.cameraTransition.startTarget,
          earthPose.target,
          smoothT
        );
        if (t >= 1) this.cameraTransition = null;
      } else {
        // Keep Earth lock in a full-orbit, plane-perpendicular framing.
        this.sceneManager.camera.position.lerp(earthPose.position, 0.12);
        this.sceneManager.controls.target.lerp(earthPose.target, 0.2);
      }
      this.lastShuttleTarget = null;
    } else if (this.cameraLockTarget === 'shuttle') {
      const nowSeconds = performance.now() / 1000;
      const shuttleTarget = this.getShuttleTarget();

      if (this.cameraTransition) {
        const tRaw = (nowSeconds - this.cameraTransition.startTime) / this.cameraTransition.duration;
        const t = Math.max(0, Math.min(1, tRaw));
        const smoothT = t * t * (3 - 2 * t); // smoothstep easing

        // Keep transition attached to the moving shuttle target.
        const targetDelta = shuttleTarget.clone().sub(this.cameraTransition.endTarget);
        const movingEndPos = this.cameraTransition.endPos.clone().add(targetDelta);

        this.sceneManager.camera.position.lerpVectors(
          this.cameraTransition.startPos,
          movingEndPos,
          smoothT
        );
        this.sceneManager.controls.target.lerpVectors(
          this.cameraTransition.startTarget,
          shuttleTarget,
          smoothT
        );

        if (t >= 1) {
          this.cameraTransition = null;
          this.lastShuttleTarget = shuttleTarget.clone();
          this.shuttleCameraDistance = this.sceneManager.camera.position.distanceTo(this.sceneManager.controls.target);
        }
      } else {
        // Preserve user orbit/pan/zoom. In lock mode we only translate camera+target
        // by the shuttle's movement so the current user view is respected.
        if (this.lastShuttleTarget) {
          const delta = shuttleTarget.clone().sub(this.lastShuttleTarget);
          this.sceneManager.camera.position.add(delta);
          this.sceneManager.controls.target.copy(shuttleTarget);
        } else {
          const delta = shuttleTarget.clone().sub(this.sceneManager.controls.target);
          this.sceneManager.camera.position.add(delta);
          this.sceneManager.controls.target.copy(shuttleTarget);
        }
        this.lastShuttleTarget = shuttleTarget.clone();
        this.shuttleCameraDistance = this.sceneManager.camera.position.distanceTo(this.sceneManager.controls.target);
      }
    } else {
      this.cameraTransition = null;
      this.lastShuttleTarget = null;
    }

    // Render
    this.sceneManager.render();
  };
}
