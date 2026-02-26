import * as THREE from 'three';
import { SCALE } from '../constants';

export class OrbitLine {
  private line: THREE.Line;
  private geometry: THREE.BufferGeometry;
  private maxPoints: number;

  constructor(maxPoints = 2000, color = 0x00aaff, renderOrder = 1) {
    this.maxPoints = maxPoints;
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    });

    this.line = new THREE.Line(this.geometry, material);
    this.line.renderOrder = renderOrder;
    this.line.frustumCulled = false;
  }

  updateFromPositions(positions: [number, number, number][]) {
    const attr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const count = Math.min(positions.length, this.maxPoints);

    for (let i = 0; i < count; i++) {
      attr.setXYZ(
        i,
        positions[i][0] * SCALE,
        positions[i][1] * SCALE,
        positions[i][2] * SCALE
      );
    }

    attr.needsUpdate = true;
    this.geometry.setDrawRange(0, count);
  }

  setVisible(visible: boolean) {
    this.line.visible = visible;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.line);
  }
}
