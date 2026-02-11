import * as THREE from 'three';
import { EARTH_RADIUS, GM_EARTH, MAX_STEPS_PER_FRAME, PHYSICS_DT, SCALE, THRUST_ACCEL } from './constants';
import { ManeuverSequence, SpacecraftState } from './types';
import { SceneManager } from './scene/scene-manager';
import { Earth } from './scene/earth';
import { SpacecraftMesh } from './scene/spacecraft';
import { OrbitLine } from './scene/orbit-line';
import { setupLighting } from './scene/lighting';
import { rk4Step } from './physics/integrator';
import { stateToElements } from './physics/orbital-elements';
import { predictOrbit } from './physics/trajectory';
import { InputManager } from './controls/input-manager';
import { SpacecraftControls } from './controls/spacecraft-controls';
import { HUD } from './ui/hud';
import { TimeControls } from './ui/time-controls';
import { Timeline } from './ui/timeline';
import { ManeuverExecutor } from './scripting/maneuver-executor';
import { getPreset } from './scripting/presets';
import { validateSequence, serializeSequence } from './scripting/maneuver-schema';

export class App {
  private sceneManager: SceneManager;
  private earth: Earth;
  private spacecraftMesh: SpacecraftMesh;
  private orbitLine: OrbitLine;
  private inputManager: InputManager;
  private spacecraftControls: SpacecraftControls;
  private hud: HUD;
  private timeControls: TimeControls;
  private timeline: Timeline;
  private maneuverExecutor: ManeuverExecutor;

  private state: SpacecraftState;
  private simTime = 0;
  private accumulator = 0;
  private lastFrameTime = 0;
  private orbitUpdateTimer = 0;
  private currentSequence: ManeuverSequence | null = null;

  constructor() {
    // Scene
    this.sceneManager = new SceneManager();
    this.earth = new Earth();
    this.earth.addTo(this.sceneManager.scene);

    setupLighting(this.sceneManager.scene);

    this.spacecraftMesh = new SpacecraftMesh();
    this.spacecraftMesh.addTo(this.sceneManager.scene);

    this.orbitLine = new OrbitLine();
    this.orbitLine.addTo(this.sceneManager.scene);

    // Controls
    this.inputManager = new InputManager();
    this.spacecraftControls = new SpacecraftControls(this.inputManager);
    this.timeControls = new TimeControls(this.inputManager);

    // UI
    this.hud = new HUD();
    this.timeline = new Timeline();
    this.maneuverExecutor = new ManeuverExecutor();

    // Initial spacecraft state: 200km LEO, equatorial, circular
    const r = EARTH_RADIUS + 200e3;
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

    // Orient spacecraft to prograde initially
    this.alignToPrograde();

    // Setup UI bindings
    this.setupUIBindings();

    // Load default preset
    this.loadSequence(getPreset('leo-circular')!);
  }

  private alignToPrograde() {
    const [vx, vy, vz] = this.state.stateVector.velocity;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed > 0.01) {
      const forward = new THREE.Vector3(-vx / speed, -vy / speed, -vz / speed);
      const up = new THREE.Vector3(0, 1, 0);
      const mat = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0),
        forward,
        up
      );
      const q = new THREE.Quaternion().setFromRotationMatrix(mat);
      this.state.quaternion = [q.x, q.y, q.z, q.w];
    }
  }

  private setupUIBindings() {
    // Preset selector
    document.getElementById('preset-select')!.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      if (!val) return;
      const seq = getPreset(val);
      if (seq) this.loadSequence(seq);
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

    this.alignToPrograde();
    this.maneuverExecutor.loadSequence(seq);
    this.timeline.loadSequence(seq);
  }

  start() {
    this.lastFrameTime = performance.now() / 1000;
    this.loop();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);

    const now = performance.now() / 1000;
    const frameDt = Math.min(now - this.lastFrameTime, 0.1); // Cap frame dt
    this.lastFrameTime = now;

    // Time controls
    this.timeControls.update();

    if (!this.timeControls.paused) {
      // Spacecraft keyboard controls (rotation uses frame dt)
      const manualThrust = this.spacecraftControls.update(this.state, frameDt);

      // Physics accumulator
      this.accumulator += frameDt * this.timeControls.warpLevel;
      let steps = 0;

      while (this.accumulator >= PHYSICS_DT && steps < MAX_STEPS_PER_FRAME) {
        // Get thrust: scripted maneuver overrides manual if active
        let thrust: [number, number, number];
        const scriptedThrust = this.maneuverExecutor.getThrustAtTime(
          this.simTime, this.state, THRUST_ACCEL
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
      }
    }

    // Update orbit prediction periodically (every 30 frames worth of sim time or on thrust change)
    this.orbitUpdateTimer += frameDt;
    if (this.orbitUpdateTimer > 0.5) {
      this.orbitUpdateTimer = 0;
      const predicted = predictOrbit(this.state.stateVector);
      this.orbitLine.updateFromPositions(predicted);
    }

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

    // Render
    this.sceneManager.render();
  };
}
