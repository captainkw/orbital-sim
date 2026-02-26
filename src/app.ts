import { EARTH_RADIUS, GM_EARTH, ISS_MASS, MAX_STEPS_PER_FRAME, PHYSICS_DT, SCALE, SHUTTLE_MASS, THRUST_FORCE } from './constants';
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
import { ISSTarget } from './scene/iss-target';
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
import { DockingOverlay } from './ui/docking-overlay';
import { ManeuverExecutor } from './scripting/maneuver-executor';
import { getPreset, buildHohmannPreset } from './scripting/presets';
import { validateSequence, serializeSequence } from './scripting/maneuver-schema';

const DOCKING_DIST = 500;    // metres — success threshold
const DOCKING_REL_VEL = 2.0; // m/s   — max approach speed at docking
const MODEL_SCALE_FAR = 1.0;
// Approximate true-size floor near docking range.
const MODEL_SCALE_NEAR = 0.00005;
const MODEL_SCALE_NEAR_DIST = 500 * SCALE;         // 0.5 km
const MODEL_SCALE_FAR_DIST = 1_272_000 * SCALE;    // 1272 km
const MODEL_SCALE_MID_DIST = 10_000 * SCALE;       // 10 km
const MODEL_SCALE_MID = 0.0005;                    // already near true-size by 10 km
const REF_LOCK_ENTER_DIST = 25_000 * SCALE;        // 25 km
const REF_LOCK_EXIT_DIST = 30_000 * SCALE;         // hysteresis to avoid flicker

export class App {
  private sceneManager: SceneManager;
  private earth: Earth;
  private spacecraftMesh: SpacecraftMesh;
  private orbitLine: OrbitLine;
  private issMesh: ISSTarget;
  private issOrbitLine: OrbitLine;
  private celestialSphere: CelestialSphere;
  private inputManager: InputManager;
  private spacecraftControls: SpacecraftControls;
  private hud: HUD;
  private timeControls: TimeControls;
  private timeline: Timeline;
  private maneuverExecutor: ManeuverExecutor;
  private crashOverlay: CrashOverlay;
  private dockingOverlay: DockingOverlay;

  private state: SpacecraftState;
  private issStateVector: StateVector | null = null;
  private docked = false;
  private dockedFlying = false; // docked & overlay dismissed — flying together
  private currentVisualScale = MODEL_SCALE_FAR;
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
  private readonly defaultShuttleCameraDistance = 2400 * 1000 * SCALE; // 20% farther than 2000 km
  private shuttleCameraDistance = this.defaultShuttleCameraDistance;
  private lastShuttleTarget: THREE.Vector3 | null = null;
  private introEarthTransitionQueued = false;
  private introStartTime = 0;
  private shuttleRefFrameLock = false;
  private shuttleRefLocalOffset = new THREE.Vector3(0.55, 0.55, -1).normalize();
  private shuttleRefDistance = this.defaultShuttleCameraDistance;
  private controlsRotateEnabled = true;
  private controlsPanEnabled = true;
  private controlsDampingEnabled = true;
  private controlsZoomEnabled = true;
  private refLockPointers = new Map<number, { x: number; y: number }>();
  private refLockLastPinchDist = 0;
  private refLockListenersAttached = false;

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

    this.issMesh = new ISSTarget();
    this.issMesh.addTo(this.sceneManager.scene);

    this.issOrbitLine = new OrbitLine(2000, 0xffaa00);
    this.issOrbitLine.setVisible(false);
    this.issOrbitLine.addTo(this.sceneManager.scene);

    // Celestial sphere (stars, sun, moon)
    this.celestialSphere = new CelestialSphere(this.sceneManager.scene, sunLight);

    // Controls
    this.inputManager = new InputManager();
    this.spacecraftControls = new SpacecraftControls(this.inputManager);
    this.timeControls = new TimeControls(this.inputManager);
    new MobileControls(this.inputManager);
    this.controlsRotateEnabled = this.sceneManager.controls.enableRotate;
    this.controlsPanEnabled = this.sceneManager.controls.enablePan;
    this.controlsDampingEnabled = this.sceneManager.controls.enableDamping;
    this.controlsZoomEnabled = this.sceneManager.controls.enableZoom;

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

    // Docking overlay
    this.dockingOverlay = new DockingOverlay();
    this.dockingOverlay.setContinueCallback(() => {
      // Dismiss overlay, enter dockedFlying state — clear docked so physics loop runs
      this.docked = false;
      this.dockedFlying = true;
      this.dockingOverlay.showUndockButton();
    });
    this.dockingOverlay.setUndockCallback(() => {
      this.undock();
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

    const transferPresets = new Set(['hohmann-leo-geo', 'hohmann-leo-meo', 'orbit-raise', 'orbit-lower', 'bielliptic-geo']);

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
      'bielliptic-geo': [200, 35786],
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
        // ISS rendezvous preset: smoothly fly the camera to the shuttle.
        if (val === 'iss-rendezvous') {
          const cameraTargetSelect = document.getElementById('camera-target') as HTMLSelectElement | null;
          if (this.cameraLockTarget !== 'shuttle') {
            this.cameraLockTarget = 'shuttle';
            if (cameraTargetSelect) cameraTargetSelect.value = 'shuttle';
            this.updateRecenterVisibility();
          }
          this.startShuttleRecenterTransition(2.0);
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
    const updateRecenterVisibility = () => this.updateRecenterVisibility();
    cameraTargetSelect.addEventListener('change', () => {
      const previousTarget = this.cameraLockTarget;
      const nextTarget = cameraTargetSelect.value as 'earth' | 'shuttle' | 'free';
      this.cameraLockTarget = nextTarget;
      this.introEarthTransitionQueued = false;

      if (previousTarget === 'earth' && nextTarget === 'shuttle') {
        this.startEarthToShuttleTransition();
      } else if (nextTarget === 'earth' && previousTarget !== 'earth') {
        this.startEarthRecenterTransition(1.1);
      } else {
        this.cameraTransition = null;
        this.lastShuttleTarget = null;
      }
      if (nextTarget !== 'shuttle' && this.shuttleRefFrameLock) {
        this.exitRefLock();
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
        this.introEarthTransitionQueued = false;
        if (this.shuttleRefFrameLock) this.exitRefLock();
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

    // Reset spacecraft state
    this.state.stateVector = {
      position: [...seq.initialState.position],
      velocity: [...seq.initialState.velocity],
    };
    this.simTime = 0;
    this.accumulator = 0;
    this.crashed = false;
    this.docked = false;
    this.dockedFlying = false;
    if (this.shuttleRefFrameLock) this.exitRefLock();
    this.crashOverlay.hide();
    this.dockingOverlay.hide();
    this.dockingOverlay.hideUndockButton();

    // ISS state — present only for rendezvous preset
    if (seq.issInitialState) {
      this.issStateVector = {
        position: [...seq.issInitialState.position] as [number, number, number],
        velocity: [...seq.issInitialState.velocity] as [number, number, number],
      };
      this.issMesh.setVisible(true);
      // Compute and draw ISS orbit line once on load
      const issOrbitPoints = predictOrbit(this.issStateVector);
      this.issOrbitLine.updateFromPositions(issOrbitPoints);
      this.issOrbitLine.setVisible(true);
    } else {
      this.issStateVector = null;
      this.issMesh.setVisible(false);
      this.issOrbitLine.setVisible(false);
    }

    this.spacecraftControls.resetOrientation();
    this.maneuverExecutor.loadSequence(seq);
    this.timeline.loadSequence(seq);
  }

  private undock() {
    this.docked = false;
    this.dockedFlying = false;
    this.dockingOverlay.hideUndockButton();
    // ISS inherits the current combined velocity — it continues on its own orbit.
    // Shuttle keeps the same position/velocity; they naturally separate over time.
  }

  start() {
    // Intro: begin in shuttle view, then transition to Earth view.
    this.cameraLockTarget = 'shuttle';
    const shuttlePose = this.getShuttleCameraPose(this.defaultShuttleCameraDistance);
    this.sceneManager.camera.position.copy(shuttlePose.position);
    this.sceneManager.controls.target.copy(shuttlePose.target);
    this.lastShuttleTarget = shuttlePose.target.clone();
    this.cameraTransition = null;

    const cameraTargetSelect = document.getElementById('camera-target') as HTMLSelectElement | null;
    if (cameraTargetSelect) cameraTargetSelect.value = 'shuttle';
    this.updateRecenterVisibility();

    this.introStartTime = performance.now() / 1000;
    this.introEarthTransitionQueued = true;

    this.lastFrameTime = performance.now() / 1000;
    this.loop();
  }

  private updateRecenterVisibility() {
    const recenterShuttleBtn = document.getElementById('btn-recenter-shuttle') as HTMLButtonElement | null;
    if (!recenterShuttleBtn) return;
    recenterShuttleBtn.style.display = this.cameraLockTarget === 'shuttle' ? 'inline-block' : 'none';
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
    const shuttlePose = this.getShuttleCameraPose(this.defaultShuttleCameraDistance);

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
      const apogee = elements.semiMajorAxis * (1 + elements.eccentricity);
      if (Number.isFinite(apogee) && apogee > 0) {
        orbitRadiusMeters = Math.max(orbitRadiusMeters, apogee);
      }
    }
    orbitRadiusMeters = Math.max(orbitRadiusMeters, EARTH_RADIUS);

    const orbitRadiusSceneUnits = orbitRadiusMeters * SCALE;
    const fovRad = THREE.MathUtils.degToRad(this.sceneManager.camera.fov);
    const fitDistance = orbitRadiusSceneUnits / Math.tan(fovRad / 2);
    const distance = fitDistance * 1.8;
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

  private updateAdaptiveModelScale() {
    // Only apply adaptive scaling in shuttle lock mode.
    // In Earth/free modes, keep model scale fixed to avoid apparent drifting shrink.
    if (this.cameraLockTarget !== 'shuttle') {
      this.spacecraftMesh.setVisualScale(MODEL_SCALE_FAR);
      if (this.issStateVector) this.issMesh.setVisualScale(MODEL_SCALE_FAR);
      return;
    }

    // Use OrbitControls zoom distance (camera-to-target) as the scaling driver.
    const cameraDist = this.sceneManager.camera.position.distanceTo(this.sceneManager.controls.target);
    let visualScale: number;
    if (cameraDist <= MODEL_SCALE_MID_DIST) {
      // Near field: 0.5 km -> 10 km, stay close to true-size envelope.
      const tNear = Math.max(0, Math.min(1,
        (cameraDist - MODEL_SCALE_NEAR_DIST) / (MODEL_SCALE_MID_DIST - MODEL_SCALE_NEAR_DIST)
      ));
      visualScale = MODEL_SCALE_NEAR + (MODEL_SCALE_MID - MODEL_SCALE_NEAR) * tNear;
    } else {
      // Far field: 10 km -> 1272 km, scale up for readability.
      const tFar = Math.max(0, Math.min(1,
        (cameraDist - MODEL_SCALE_MID_DIST) / (MODEL_SCALE_FAR_DIST - MODEL_SCALE_MID_DIST)
      ));
      visualScale = MODEL_SCALE_MID + (MODEL_SCALE_FAR - MODEL_SCALE_MID) * tFar;
    }
    this.currentVisualScale = visualScale;

    this.spacecraftMesh.setVisualScale(visualScale);
    if (this.issStateVector) {
      this.issMesh.setVisualScale(visualScale);
    }
  }

  // --- Shuttle reference-frame lock: custom input handlers ---
  // When locked, OrbitControls is fully disabled. We handle zoom (wheel)
  // and orbit (pointer drag) ourselves so nothing can fight our camera placement.

  private onRefLockWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = 1 + e.deltaY * 0.001;
    // No upper cap — let shuttleRefDistance exceed REF_LOCK_EXIT_DIST so the
    // exit condition in updateShuttleRefFrameLock fires naturally.
    this.shuttleRefDistance = Math.max(
      this.sceneManager.controls.minDistance,
      this.shuttleRefDistance * factor
    );
  };

  private onRefLockPointerDown = (e: PointerEvent) => {
    this.refLockPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.refLockPointers.size === 2) {
      const pts = [...this.refLockPointers.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      this.refLockLastPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  };

  private onRefLockPointerMove = (e: PointerEvent) => {
    const prev = this.refLockPointers.get(e.pointerId);
    if (!prev) return;

    if (this.refLockPointers.size >= 2) {
      // Two-finger pinch — update this pointer then compute new pinch distance.
      this.refLockPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...this.refLockPointers.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const pinchDist = Math.sqrt(dx * dx + dy * dy);
      if (this.refLockLastPinchDist > 0 && pinchDist > 0) {
        // Spreading fingers zooms in (smaller distance), pinching zooms out.
        const factor = this.refLockLastPinchDist / pinchDist;
        // No upper cap — allow exceeding REF_LOCK_EXIT_DIST to trigger lock exit.
        this.shuttleRefDistance = Math.max(
          this.sceneManager.controls.minDistance,
          this.shuttleRefDistance * factor
        );
      }
      this.refLockLastPinchDist = pinchDist;
    } else {
      // Single pointer — orbit around shuttle.
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.refLockPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const sensitivity = 0.005;
      const yAxis = new THREE.Vector3(0, 1, 0);
      this.shuttleRefLocalOffset.applyAxisAngle(yAxis, -dx * sensitivity);
      const rightAxis = new THREE.Vector3()
        .crossVectors(yAxis, this.shuttleRefLocalOffset)
        .normalize();
      if (rightAxis.lengthSq() > 0.001) {
        this.shuttleRefLocalOffset.applyAxisAngle(rightAxis, -dy * sensitivity);
      }
      this.shuttleRefLocalOffset.normalize();
    }
  };

  private onRefLockPointerUp = (e: PointerEvent) => {
    this.refLockPointers.delete(e.pointerId);
    this.refLockLastPinchDist = 0;
  };

  private attachRefLockListeners() {
    if (this.refLockListenersAttached) return;
    const el = this.sceneManager.renderer.domElement;
    el.addEventListener('wheel', this.onRefLockWheel, { passive: false });
    el.addEventListener('pointerdown', this.onRefLockPointerDown);
    el.addEventListener('pointermove', this.onRefLockPointerMove);
    el.addEventListener('pointerup', this.onRefLockPointerUp);
    el.addEventListener('pointercancel', this.onRefLockPointerUp);
    el.addEventListener('pointerleave', this.onRefLockPointerUp);
    this.refLockListenersAttached = true;
  }

  private detachRefLockListeners() {
    if (!this.refLockListenersAttached) return;
    const el = this.sceneManager.renderer.domElement;
    el.removeEventListener('wheel', this.onRefLockWheel);
    el.removeEventListener('pointerdown', this.onRefLockPointerDown);
    el.removeEventListener('pointermove', this.onRefLockPointerMove);
    el.removeEventListener('pointerup', this.onRefLockPointerUp);
    el.removeEventListener('pointercancel', this.onRefLockPointerUp);
    el.removeEventListener('pointerleave', this.onRefLockPointerUp);
    this.refLockListenersAttached = false;
  }

  private exitRefLock() {
    this.shuttleRefFrameLock = false;
    this.refLockPointers.clear();
    this.refLockLastPinchDist = 0;
    this.detachRefLockListeners();
    this.sceneManager.controls.enableRotate = this.controlsRotateEnabled;
    this.sceneManager.controls.enablePan = this.controlsPanEnabled;
    this.sceneManager.controls.enableZoom = this.controlsZoomEnabled;
    this.sceneManager.controls.enableDamping = this.controlsDampingEnabled;
  }

  private updateShuttleRefFrameLock() {
    if (this.cameraLockTarget !== 'shuttle') {
      if (this.shuttleRefFrameLock) this.exitRefLock();
      return;
    }

    if (this.shuttleRefFrameLock) {
      if (this.shuttleRefDistance >= REF_LOCK_EXIT_DIST) {
        this.exitRefLock();
      }
      return;
    }

    // Always measure distance from camera to the actual shuttle, not the
    // (potentially panned) controls.target. On mobile, two-finger pan can
    // drift controls.target far from the shuttle, causing a false trigger
    // that locks with an incorrect shuttleRefDistance (~47 km snap bug).
    const shuttleTarget = this.getShuttleTarget();
    const offsetWorld = this.sceneManager.camera.position.clone().sub(shuttleTarget);
    const zoomDist = offsetWorld.length();
    if (zoomDist <= REF_LOCK_ENTER_DIST) {
      const [qx, qy, qz, qw] = this.state.quaternion;
      const shuttleQuat = new THREE.Quaternion(qx, qy, qz, qw);
      const invQuat = shuttleQuat.clone().invert();
      if (offsetWorld.lengthSq() > 1e-10) {
        this.shuttleRefDistance = zoomDist;
        this.shuttleRefLocalOffset.copy(
          offsetWorld.clone().normalize().applyQuaternion(invQuat)
        );
      }
      this.shuttleRefFrameLock = true;

      this.sceneManager.controls.enableRotate = false;
      this.sceneManager.controls.enablePan = false;
      this.sceneManager.controls.enableZoom = false;
      this.sceneManager.controls.enableDamping = false;
      this.attachRefLockListeners();
    }
  }

  /** Write-only: positions the camera from stored shuttle-local state. */
  private applyShuttleReferenceCamera(shuttleTarget: THREE.Vector3) {
    const [qx, qy, qz, qw] = this.state.quaternion;
    const shuttleQuat = new THREE.Quaternion(qx, qy, qz, qw);

    const worldViewDir = this.shuttleRefLocalOffset.clone()
      .applyQuaternion(shuttleQuat).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(shuttleQuat).normalize();

    this.sceneManager.camera.up.copy(worldUp);
    this.sceneManager.camera.position.copy(
      shuttleTarget.clone().addScaledVector(worldViewDir, this.shuttleRefDistance)
    );
    this.sceneManager.controls.target.copy(shuttleTarget);
    this.sceneManager.camera.lookAt(shuttleTarget);
  }

  private loop = () => {
    requestAnimationFrame(this.loop);

    const now = performance.now() / 1000;
    const frameDt = Math.min(now - this.lastFrameTime, 0.1);
    this.lastFrameTime = now;

    // Time controls
    this.timeControls.update();

    if (this.introEarthTransitionQueued && (now - this.introStartTime) > 2.0) {
      this.introEarthTransitionQueued = false;
      this.cameraLockTarget = 'earth';
      this.startEarthRecenterTransition(1.1);
      const cameraTargetSelect = document.getElementById('camera-target') as HTMLSelectElement | null;
      if (cameraTargetSelect) cameraTargetSelect.value = 'earth';
      this.updateRecenterVisibility();
    }

    // Thrust acceleration scales down by combined mass when docked to ISS.
    // THRUST_FORCE = SHUTTLE_MASS * 10 m/s²; docked = same force / (shuttle + ISS).
    const activeMass = this.dockedFlying ? SHUTTLE_MASS + ISS_MASS : SHUTTLE_MASS;
    const thrustAccel = THRUST_FORCE / activeMass;

    if (!this.timeControls.paused && !this.crashed && !this.docked) {
      // Spacecraft keyboard controls (rotation uses frame dt)
      const manualThrust = this.spacecraftControls.update(this.state, frameDt, thrustAccel);

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

        // RK4 step — spacecraft
        const s = this.state.stateVector;
        const newState = rk4Step(
          [s.position[0], s.position[1], s.position[2],
           s.velocity[0], s.velocity[1], s.velocity[2]],
          PHYSICS_DT,
          thrust
        );
        s.position = [newState[0], newState[1], newState[2]];
        s.velocity = [newState[3], newState[4], newState[5]];

        if (this.issStateVector) {
          if (this.dockedFlying) {
            // Docked: ISS rigidly follows the shuttle's physics position/velocity.
            this.issStateVector.position = [...s.position] as [number, number, number];
            this.issStateVector.velocity = [...s.velocity] as [number, number, number];
          } else {
            // Undocked: ISS propagates independently (pure Keplerian, no thrust).
            const iv = this.issStateVector;
            const newISS = rk4Step(
              [iv.position[0], iv.position[1], iv.position[2],
               iv.velocity[0], iv.velocity[1], iv.velocity[2]],
              PHYSICS_DT
            );
            iv.position = [newISS[0], newISS[1], newISS[2]];
            iv.velocity = [newISS[3], newISS[4], newISS[5]];
          }
        }

        this.simTime += PHYSICS_DT;
        this.accumulator -= PHYSICS_DT;
        steps++;

        // Check crash
        const r = Math.sqrt(s.position[0] ** 2 + s.position[1] ** 2 + s.position[2] ** 2);
        const altitude = r - EARTH_RADIUS;
        if (this.crashOverlay.checkCrash(altitude)) {
          this.crashed = true;
          this.dockedFlying = false;
          this.dockingOverlay.hideUndockButton();
          this.crashOverlay.show();
          break;
        }

        // Check docking (only when not already docked)
        if (this.issStateVector && !this.docked && !this.dockedFlying) {
          const iv = this.issStateVector;
          const dx = s.position[0] - iv.position[0];
          const dy = s.position[1] - iv.position[1];
          const dz = s.position[2] - iv.position[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < DOCKING_DIST) {
            const rvx = s.velocity[0] - iv.velocity[0];
            const rvy = s.velocity[1] - iv.velocity[1];
            const rvz = s.velocity[2] - iv.velocity[2];
            const relVel = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
            if (relVel < DOCKING_REL_VEL) {
              this.docked = true;
              this.dockingOverlay.show();
              break;
            }
          }
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

    // Hide the ISS orbit line during close approach and while docked to prevent
    // z-fighting: once both craft share the same ~408 km orbit, their predicted
    // paths are identical circles and flicker against each other.
    if (this.issStateVector) {
      const s = this.state.stateVector;
      const iv = this.issStateVector;
      const dx = s.position[0] - iv.position[0];
      const dy = s.position[1] - iv.position[1];
      const dz = s.position[2] - iv.position[2];
      const approachDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const hideIssorbit = this.dockedFlying || approachDist < 50_000; // < 50 km
      this.issOrbitLine.setVisible(!hideIssorbit);
    }

    // Update celestial sphere
    this.celestialSphere.update(this.simTime, 172);

    // Update visuals
    this.spacecraftMesh.updateFromState(this.state);

    if (this.issStateVector) {
      this.issMesh.updateFromState(this.issStateVector);
    }

    // Update HUD
    const elements = stateToElements(this.state.stateVector);
    const zoomDistanceMeters =
      this.sceneManager.camera.position.distanceTo(this.sceneManager.controls.target) / SCALE;
    this.hud.update(
      this.state,
      elements,
      this.simTime,
      this.timeControls.warpLevel,
      this.timeControls.paused,
      this.issStateVector,
      zoomDistanceMeters,
      this.currentVisualScale
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
        if (t >= 1) {
          this.cameraTransition = null;
          this.sceneManager.controls.target.copy(earthPose.target);
        }
      }
      this.lastShuttleTarget = null;
    } else if (this.cameraLockTarget === 'shuttle') {
      const nowSeconds = performance.now() / 1000;
      const shuttleTarget = this.getShuttleTarget();
      this.updateShuttleRefFrameLock();

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
        if (this.shuttleRefFrameLock) {
          this.applyShuttleReferenceCamera(shuttleTarget);
        } else {
          this.sceneManager.camera.up.set(0, 0, -1);
          if (this.lastShuttleTarget) {
            const delta = shuttleTarget.clone().sub(this.lastShuttleTarget);
            this.sceneManager.camera.position.add(delta);
            this.sceneManager.controls.target.copy(shuttleTarget);
          } else {
            const delta = shuttleTarget.clone().sub(this.sceneManager.controls.target);
            this.sceneManager.camera.position.add(delta);
            this.sceneManager.controls.target.copy(shuttleTarget);
          }
        }
        this.lastShuttleTarget = shuttleTarget.clone();
        this.shuttleCameraDistance = this.sceneManager.camera.position.distanceTo(this.sceneManager.controls.target);
      }
    } else {
      if (this.shuttleRefFrameLock) this.exitRefLock();
      this.sceneManager.camera.up.set(0, 0, -1);
      this.cameraTransition = null;
      this.lastShuttleTarget = null;
    }

    // Scale rendered models down as camera approaches the shuttle, so docking
    // visuals become progressively closer to true scale at close range.
    this.updateAdaptiveModelScale();

    // When ref-frame locked we own the camera entirely; skip OrbitControls.
    if (!this.shuttleRefFrameLock) {
      this.sceneManager.controls.update();
    }

    // Render
    this.sceneManager.render();
  };
}
