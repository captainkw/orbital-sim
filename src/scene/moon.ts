import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { SCALE, MOON_RADIUS } from '../constants';

// ── Tweak these to adjust the Moon's orientation ──
// Pitch: positive = tilt "up" (north pole tips away from Earth). Degrees.
const MOON_PITCH_OFFSET_DEG: number = 270;
// Yaw: positive = rotate the visible face clockwise. Degrees.
const MOON_YAW_OFFSET_DEG: number = -80;

/**
 * Moon scene object.
 * Loads a GLB model and implements tidal locking so the near side always faces Earth.
 */
export class Moon {
  readonly group: THREE.Group;
  private modelLoaded = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    dracoLoader.setDecoderConfig({ type: 'js' });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      `${import.meta.env.BASE_URL}models/moon/moon.glb`,
      (gltf) => {
        const model = gltf.scene;

        // Center the model on its bounding box
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // Scale so the model matches Moon radius in scene units
        const moonSceneRadius = MOON_RADIUS * SCALE;
        const scaleFactor = (moonSceneRadius * 2) / maxDim;
        model.scale.setScalar(scaleFactor);
        model.position.set(
          -center.x * scaleFactor,
          -center.y * scaleFactor,
          -center.z * scaleFactor
        );

        // Ensure textures render correctly and add slight emissive for dark-side visibility
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              // Ensure texture color space is correct (sRGB for diffuse maps)
              if ('map' in m && (m as any).map instanceof THREE.Texture) {
                (m as any).map.colorSpace = THREE.SRGBColorSpace;
                (m as any).map.needsUpdate = true;
              }
              // Add slight emissive so it's visible on the unlit side
              if ('emissive' in m) {
                (m as any).emissive.setHex(0x222222);
                (m as any).emissiveIntensity = 0.2;
              }
              m.needsUpdate = true;
            });
          }
        });

        this.group.add(model);
        this.modelLoaded = true;
        dracoLoader.dispose();
      },
      undefined,
      (error) => {
        console.warn('Failed to load Moon GLB, using textured sphere fallback:', error);
        dracoLoader.dispose();
        this.createFallback();
      }
    );
  }

  private createFallback() {
    const moonSceneRadius = MOON_RADIUS * SCALE;
    const geometry = new THREE.SphereGeometry(moonSceneRadius, 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
    const mesh = new THREE.Mesh(geometry, material);
    this.group.add(mesh);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      `${import.meta.env.BASE_URL}textures/moon_map.jpg`,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      () => { /* keep plain gray */ }
    );

    this.modelLoaded = true;
  }

  /**
   * Update Moon position and orientation (tidal locking).
   * The Moon's near side always faces Earth (origin in our ECI system).
   * @param positionMeters Moon center position in ECI meters [x, y, z]
   */
  updatePosition(positionMeters: [number, number, number]) {
    const [x, y, z] = positionMeters;
    this.group.position.set(x * SCALE, y * SCALE, z * SCALE);

    // Tidal locking: -Z axis of the Moon points toward Earth (origin).
    const moonPos = new THREE.Vector3(x, y, z);
    const toEarth = moonPos.clone().negate().normalize();
    const north = new THREE.Vector3(0, 1, 0);

    // Build rotation matrix: -Z toward Earth, Y roughly north
    const right = new THREE.Vector3().crossVectors(north, toEarth).normalize();
    if (right.lengthSq() < 0.001) {
      right.set(1, 0, 0);
    }
    const up = new THREE.Vector3().crossVectors(toEarth, right).normalize();

    const m = new THREE.Matrix4().makeBasis(right, up, toEarth);
    this.group.quaternion.setFromRotationMatrix(m);

    // Apply orientation tweaks (pitch around local right axis, yaw around local up axis)
    if (MOON_PITCH_OFFSET_DEG !== 0) {
      const pitchQ = new THREE.Quaternion().setFromAxisAngle(right, MOON_PITCH_OFFSET_DEG * Math.PI / 180);
      this.group.quaternion.premultiply(pitchQ);
    }
    if (MOON_YAW_OFFSET_DEG !== 0) {
      const yawQ = new THREE.Quaternion().setFromAxisAngle(up, MOON_YAW_OFFSET_DEG * Math.PI / 180);
      this.group.quaternion.premultiply(yawQ);
    }
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }
}
