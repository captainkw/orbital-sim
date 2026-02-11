// Camera controls are managed directly by SceneManager via OrbitControls.
// This module is a placeholder for any future camera-specific logic
// (e.g., tracking the spacecraft, switching views).

import { SceneManager } from '../scene/scene-manager';
import * as THREE from 'three';
import { SCALE } from '../constants';

export class CameraController {
  private sceneManager: SceneManager;
  private trackTarget: THREE.Vector3 | null = null;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  /** Set OrbitControls target to follow a position (in meters) */
  trackPosition(position: [number, number, number]) {
    this.sceneManager.controls.target.set(
      position[0] * SCALE,
      position[1] * SCALE,
      position[2] * SCALE
    );
  }
}
