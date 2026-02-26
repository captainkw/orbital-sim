import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { SCALE } from '../constants';
import { SpacecraftState } from '../types';

export class SpacecraftMesh {
  readonly group: THREE.Group;
  private shuttleGroup: THREE.Group;
  readonly thrustArrow: THREE.ArrowHelper;
  private readonly shuttleDoorOpenAngleX = THREE.MathUtils.degToRad(30);
  private visualScale = 1;

  constructor() {
    this.group = new THREE.Group();
    this.shuttleGroup = new THREE.Group();
    this.group.add(this.shuttleGroup);

    this.loadShuttleComposite();

    // Thrust arrow (initially hidden)
    this.thrustArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      1.0,
      0xff4400
    );
    this.thrustArrow.visible = false;
    this.group.add(this.thrustArrow);
  }

  updateFromState(state: SpacecraftState) {
    const [x, y, z] = state.stateVector.position;
    this.group.position.set(x * SCALE, y * SCALE, z * SCALE);

    // Set quaternion
    const [qx, qy, qz, qw] = state.quaternion;
    this.group.quaternion.set(qx, qy, qz, qw);

    // Thrust visualization
    if (state.thrustActive) {
      const [tx, ty, tz] = state.thrustDirection;
      const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (len > 0) {
        // Transform ECI thrust direction to local frame, then negate for exhaust
        const dir = new THREE.Vector3(-tx / len, -ty / len, -tz / len);
        const invQuat = this.group.quaternion.clone().invert();
        dir.applyQuaternion(invQuat);
        this.thrustArrow.setDirection(dir);
        this.thrustArrow.setLength(0.8);
        this.thrustArrow.visible = true;
      }
    } else {
      this.thrustArrow.visible = false;
    }
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }

  /**
   * Adjust only the rendered shuttle model scale (not orbital position).
   * Used to make close-range rendezvous visuals more true-to-scale.
   */
  setVisualScale(scale: number) {
    const clamped = Math.max(0.00001, scale);
    if (Math.abs(clamped - this.visualScale) < 1e-8) return;
    this.visualScale = clamped;
    this.shuttleGroup.scale.setScalar(clamped);
  }

  private loadShuttleComposite() {
    // Base hull uses Draco compression.
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);

    const baseLoader = new GLTFLoader();
    baseLoader.setDRACOLoader(dracoLoader);

    const basePath = `${import.meta.env.BASE_URL}models/shuttle.glb`;
    baseLoader.load(
      basePath,
      (gltf) => {
        const baseModel = gltf.scene;

        // Compute alignment from the base hull in model-native coordinates.
        const box = new THREE.Box3().setFromObject(baseModel);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const shuttleLength = size.x;
        const shuttleWidth = size.y;
        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredSize = 1.0;
        const scaleFactor = maxDim > 0 ? desiredSize / maxDim : 1.0;

        this.applySharedShuttleTransform(baseModel, center, scaleFactor);
        this.tuneModelMaterials(baseModel);
        this.shuttleGroup.add(baseModel);

        // NASA part files exported as separate meshes.
        // Doors can be articulated (opened), while eng/rcs need explicit
        // placement offsets in this scene's shuttle frame.
        const partLoader = new GLTFLoader();
        const partFiles = [
          'shuttle-door-prt.glb',
          'shuttle-door-stb.glb',
          'shuttle-eng.glb',
          'shuttle-rcs.glb',
        ];

        partFiles.forEach((partFile) => {
          partLoader.load(
            `${import.meta.env.BASE_URL}models/${partFile}`,
            (partGltf) => {
              const partModel = partGltf.scene;
              this.tuneModelMaterials(partModel);

              if (partFile === 'shuttle-door-prt.glb') {
                this.addDoorPart(
                  partModel,
                  center,
                  scaleFactor,
                  'prt',
                  new THREE.Vector3(215, 50, 0) 
                );  // shuttleWidth
              } else if (partFile === 'shuttle-door-stb.glb') {
                this.addDoorPart(
                  partModel,
                  center,
                  scaleFactor,
                  'stb',
                  new THREE.Vector3(-215, 50, 0)
                );
              } else if (partFile === 'shuttle-eng.glb') {
                // Use 3 engine instances at the aft end with slight spacing.
                const engineOffsets = [
                  new THREE.Vector3(-510, 0.055 * shuttleWidth, -45),
                  new THREE.Vector3(-500, 0, 70),
                  new THREE.Vector3(-510, -0.055 * shuttleWidth, -45),
                ];
                engineOffsets.forEach((offset, idx) => {
                  const instance = idx === 0 ? partModel : partModel.clone(true);
                  this.addAttachedPart(instance, center, scaleFactor, offset);
                });
              } else if (partFile === 'shuttle-rcs.glb') {
                // Use 2 RCS instances at the aft upper section.
                const rcsOffsets = [
                  new THREE.Vector3(-510, 0.095 * shuttleWidth, 100),
                  new THREE.Vector3(-510, -0.095 * shuttleWidth, 100),
                ];
                rcsOffsets.forEach((offset, idx) => {
                  const instance = idx === 0 ? partModel : partModel.clone(true);
                  this.addAttachedPart(instance, center, scaleFactor, offset);
                });
              } else {
                this.applySharedShuttleTransform(partModel, center, scaleFactor);
                this.shuttleGroup.add(partModel);
              }
            },
            undefined,
            (error) => {
              console.warn(`Optional shuttle part failed to load: ${partFile}`, error);
            }
          );
        });

        dracoLoader.dispose();
      },
      undefined,
      (error) => {
        console.error('Failed to load shuttle GLB:', error);
        dracoLoader.dispose();
      }
    );
  }

  private applySharedShuttleTransform(
    model: THREE.Object3D,
    baseCenter: THREE.Vector3,
    scaleFactor: number
  ) {
    model.scale.setScalar(scaleFactor);
    model.position.set(
      -baseCenter.x * scaleFactor,
      -baseCenter.y * scaleFactor,
      -baseCenter.z * scaleFactor,
    );

    // Keep orientation consistent with existing control/camera assumptions.
    model.rotation.order = 'YXZ';
    model.rotation.x = -Math.PI / 2;
    model.rotation.z = -Math.PI / 2;
  }

  private addAttachedPart(
    partModel: THREE.Object3D,
    baseCenter: THREE.Vector3,
    scaleFactor: number,
    nativeOffset: THREE.Vector3
  ) {
    const anchor = new THREE.Group();
    this.applySharedShuttleTransform(anchor, baseCenter, scaleFactor);
    partModel.position.copy(nativeOffset);
    anchor.add(partModel);
    this.shuttleGroup.add(anchor);
  }

  private addDoorPart(
    partModel: THREE.Object3D,
    baseCenter: THREE.Vector3,
    scaleFactor: number,
    side: 'prt' | 'stb',
    breakoutOffset: THREE.Vector3
  ) {
    const doorAnchor = new THREE.Group();
    this.applySharedShuttleTransform(doorAnchor, baseCenter, scaleFactor);
    doorAnchor.position.addScaledVector(breakoutOffset, scaleFactor);
    doorAnchor.add(partModel);

    // Open doors by rotating around local X in opposite directions so each
    // moves away from centerline.
    const sign = side === 'prt' ? 1 : -1;
    const extraOpen = THREE.MathUtils.degToRad(side === 'prt' ? -30 : 30);
    doorAnchor.rotateX(sign * this.shuttleDoorOpenAngleX + Math.PI + extraOpen);

    this.shuttleGroup.add(doorAnchor);
  }

  private tuneModelMaterials(model: THREE.Object3D) {
    model.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial) {
            m.emissive.setHex(0x221f1a);
            m.emissiveIntensity = 0.4;
          }
        });
      }
    });
  }
}
