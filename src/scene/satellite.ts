import * as THREE from 'three';
import { SCALE } from '../constants';
import { StateVector } from '../types';

/**
 * Procedural Starlink-style satellite mesh.
 * Flat chassis body + single large solar panel wing + colored marker dot.
 */
export class SatelliteMesh {
  readonly group: THREE.Group;
  private modelGroup: THREE.Group;
  private visualScale = 1;

  constructor(markerColor = 0x44ff44) {
    this.group = new THREE.Group();
    this.modelGroup = new THREE.Group();
    this.group.add(this.modelGroup);
    this.buildModel(markerColor);
  }

  private buildModel(markerColor: number) {
    // Flat chassis (~2.8m x 1.4m x 0.2m scaled to scene-unit proportions)
    const bodyGeo = new THREE.BoxGeometry(0.35, 0.03, 0.18);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xaaaabb,
      roughness: 0.4,
      metalness: 0.6,
      emissive: 0x111122,
      emissiveIntensity: 0.3,
    });
    this.modelGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

    // Solar panel array
    const panelGeo = new THREE.BoxGeometry(1.6, 0.003, 0.35);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a55,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x0a0a44,
      emissiveIntensity: 0.5,
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 0.016, 0.27);
    this.modelGroup.add(panel);

    // Colored marker sphere so the satellite is visible at distance
    const markerGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const markerMat = new THREE.MeshBasicMaterial({ color: markerColor });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0, 0.06, 0);
    this.modelGroup.add(marker);
  }

  updateFromState(sv: StateVector) {
    const [x, y, z] = sv.position;
    this.group.position.set(x * SCALE, y * SCALE, z * SCALE);

    const pos = new THREE.Vector3(x, y, z);
    const vel = new THREE.Vector3(sv.velocity[0], sv.velocity[1], sv.velocity[2]);
    if (pos.lengthSq() < 1e-9 || vel.lengthSq() < 1e-9) return;

    // Orient: local +Y radially outward, local +Z prograde
    const radialUp = pos.clone().normalize();
    const prograde = vel.clone().normalize();
    const right = new THREE.Vector3().crossVectors(radialUp, prograde).normalize();
    if (right.lengthSq() < 1e-9) return;
    const up = new THREE.Vector3().crossVectors(prograde, right).normalize();
    const m = new THREE.Matrix4().makeBasis(right, up, prograde);
    this.group.quaternion.setFromRotationMatrix(m);
  }

  setVisualScale(scale: number) {
    const clamped = Math.max(0.00001, scale);
    if (Math.abs(clamped - this.visualScale) < 1e-8) return;
    this.visualScale = clamped;
    this.modelGroup.scale.setScalar(clamped);
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }

  removeFrom(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}
