import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { SCALE } from '../constants';
import { StateVector } from '../types';

export class OrionMesh {
  readonly group: THREE.Group;
  private modelLoaded = false;
  private visualScale = 1;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    dracoLoader.setDecoderConfig({ type: 'js' });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      `${import.meta.env.BASE_URL}models/orion/sls-eus.glb`,
      (gltf) => {
        const model = gltf.scene;

        // Center and scale
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = maxDim > 0 ? 1.5 / maxDim : 1.0;
        model.scale.setScalar(scaleFactor);
        model.position.set(
          -center.x * scaleFactor,
          -center.y * scaleFactor,
          -center.z * scaleFactor
        );

        // Emissive tint so model is visible against dark space
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              if (m instanceof THREE.MeshStandardMaterial) {
                m.emissive.setHex(0x111122);
                m.emissiveIntensity = 0.3;
              }
            });
          }
        });

        this.group.add(model);
        this.modelLoaded = true;
        dracoLoader.dispose();
      },
      undefined,
      (error) => {
        console.error('Failed to load Orion GLB:', error);
        dracoLoader.dispose();
        this.createFallbackGeometry();
      }
    );
  }

  private createFallbackGeometry() {
    const emissiveParams = { emissive: new THREE.Color(0x111122), emissiveIntensity: 0.3 };

    // Service module cylinder
    const cylGeo = new THREE.CylinderGeometry(2.5, 2.5, 4, 16);
    const cylMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, ...emissiveParams });
    const cylinder = new THREE.Mesh(cylGeo, cylMat);
    this.group.add(cylinder);

    // Capsule cone on top
    const coneGeo = new THREE.ConeGeometry(2.5, 3, 16);
    const coneMat = new THREE.MeshPhongMaterial({ color: 0x888888, ...emissiveParams });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 3.5; // half cylinder height (2) + half cone height (1.5)
    this.group.add(cone);

    // 4 solar panels positioned symmetrically
    const panelGeo = new THREE.BoxGeometry(6, 0.05, 1.5);
    const panelMat = new THREE.MeshPhongMaterial({ color: 0x1a237e, ...emissiveParams });

    const panelOffsets: [number, number][] = [
      [5, 0],   // +X
      [-5, 0],  // -X
      [0, 5],   // +Z
      [0, -5],  // -Z
    ];

    for (const [ox, oz] of panelOffsets) {
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(ox, 0, oz);
      // Rotate panels along Z axis so they face outward for +/-Z panels
      if (oz !== 0) {
        panel.rotation.y = Math.PI / 2;
      }
      this.group.add(panel);
    }

    this.modelLoaded = true;
  }

  /**
   * Move Orion to its current orbital position and orient prograde.
   * +Z along velocity direction, +Y radially outward from Earth.
   */
  updateFromState(sv: StateVector) {
    const [x, y, z] = sv.position;
    this.group.position.set(x * SCALE, y * SCALE, z * SCALE);

    // Orient: +Z prograde (velocity), +Y radially outward
    const pos = new THREE.Vector3(x, y, z);
    const vel = new THREE.Vector3(sv.velocity[0], sv.velocity[1], sv.velocity[2]);
    const radialUp = pos.clone().normalize();            // radially outward = local +Y
    const prograde = vel.clone().normalize();             // velocity direction = local +Z
    const right = new THREE.Vector3().crossVectors(radialUp, prograde).normalize();
    const up = new THREE.Vector3().crossVectors(prograde, right).normalize();

    const m = new THREE.Matrix4().makeBasis(right, up, prograde);
    this.group.quaternion.setFromRotationMatrix(m);
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  /**
   * Adjust rendered Orion size without affecting orbital position.
   */
  setVisualScale(scale: number) {
    const clamped = Math.max(0.00001, scale);
    if (Math.abs(clamped - this.visualScale) < 1e-8) return;
    this.visualScale = clamped;
    this.group.scale.setScalar(clamped);
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }
}
