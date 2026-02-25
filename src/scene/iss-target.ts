import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { SCALE } from '../constants';
import { StateVector } from '../types';

export class ISSTarget {
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
      `${import.meta.env.BASE_URL}models/iss/iss.glb`,
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
        // Keep mesh origin aligned to ISS physics position after scaling.
        model.position.set(
          -center.x * scaleFactor,
          -center.y * scaleFactor,
          -center.z * scaleFactor
        );

        // Emissive tint so ISS is clearly visible against space
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              if (m instanceof THREE.MeshStandardMaterial) {
                m.emissive.setHex(0x112211);
                m.emissiveIntensity = 0.5;
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
        console.error('Failed to load ISS GLB:', error);
        dracoLoader.dispose();
      }
    );

    // Docking-target indicator ring (amber, always visible when ISS is shown)
    const ringGeo = new THREE.RingGeometry(1.8, 2.3, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.group.add(ring);
  }

  /**
   * Move ISS to its current orbital position and orient nadir-facing
   * (local -Y toward Earth center, local +Z along velocity direction).
   */
  updateFromState(sv: StateVector) {
    const [x, y, z] = sv.position;
    this.group.position.set(x * SCALE, y * SCALE, z * SCALE);

    // Nadir (-Y) toward Earth, +Z prograde
    const pos = new THREE.Vector3(x, y, z);
    const vel = new THREE.Vector3(sv.velocity[0], sv.velocity[1], sv.velocity[2]);
    const nadirUp = pos.clone().normalize();          // radially outward = local +Y
    const prograde = vel.clone().normalize();          // velocity direction = local +Z
    const right = new THREE.Vector3().crossVectors(nadirUp, prograde).normalize();
    const up = new THREE.Vector3().crossVectors(prograde, right).normalize();

    const m = new THREE.Matrix4().makeBasis(right, up, prograde);
    this.group.quaternion.setFromRotationMatrix(m);
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  /**
   * Adjust rendered ISS size without affecting orbital position.
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
