import * as THREE from 'three';
import { SCALE } from '../constants';
import { SpacecraftState } from '../types';

export class SpacecraftMesh {
  readonly group: THREE.Group;
  private coneMesh: THREE.Mesh;
  readonly thrustArrow: THREE.ArrowHelper;

  constructor() {
    this.group = new THREE.Group();

    // Cone pointing along -Z (local forward/prograde)
    const coneGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
    coneGeo.rotateX(Math.PI / 2); // Point cone along -Z
    const coneMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, emissive: 0x222222 });
    this.coneMesh = new THREE.Mesh(coneGeo, coneMat);
    this.group.add(this.coneMesh);

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
        // Show arrow opposite to thrust direction (exhaust)
        this.thrustArrow.setDirection(new THREE.Vector3(-tx / len, -ty / len, -tz / len));
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
