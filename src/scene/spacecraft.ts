import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { SCALE } from '../constants';
import { SpacecraftState } from '../types';

export class SpacecraftMesh {
  readonly group: THREE.Group;
  private shuttleGroup: THREE.Group;
  readonly thrustArrow: THREE.ArrowHelper;

  constructor() {
    this.group = new THREE.Group();
    this.shuttleGroup = new THREE.Group();
    this.group.add(this.shuttleGroup);

    // Load the STL shuttle model
    const loader = new STLLoader();
    loader.load(`${import.meta.env.BASE_URL}models/shuttle.stl`, (geometry) => {
      // Center the geometry on its bounding box
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const center = new THREE.Vector3();
      box.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      // Compute size to normalize scale
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      // Scale for shuttle controlled here
      const desiredSize = 1.0;
      const scaleFactor = desiredSize / maxDim;

      const mat = new THREE.MeshPhongMaterial({
        color: 0xeeeeee,
        emissive: 0x111111,
        shininess: 30,
        flatShading: true,
      });

      const mesh = new THREE.Mesh(geometry, mat);
      mesh.scale.setScalar(scaleFactor);

      // Orient so the nose points along -Z (local forward)
      // Pitch down 90° (nose down), then roll left 90°
      mesh.rotation.order = 'YXZ';
      mesh.rotation.x = -Math.PI / 2; // pitch down 90°
      mesh.rotation.z = -Math.PI / 2; // roll left 90°

      // Offset upward so the shuttle sits above the orbit path
      mesh.position.y = 0.175;

      this.shuttleGroup.add(mesh);
    });

    // Axes helper for dev
    this.group.add(new THREE.AxesHelper(0.5));

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
}
