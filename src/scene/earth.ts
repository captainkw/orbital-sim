import * as THREE from 'three';
import { EARTH_RADIUS, SCALE } from '../constants';

export class Earth {
  readonly mesh: THREE.Mesh;

  constructor() {
    const radius = EARTH_RADIUS * SCALE;
    const geometry = new THREE.SphereGeometry(radius, 64, 64);

    const loader = new THREE.TextureLoader();

    const material = new THREE.MeshPhongMaterial({
      map: loader.load(`${import.meta.env.BASE_URL}textures/earth_daymap.jpg`),
      specular: new THREE.Color(0x333333),
      shininess: 15,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    // Earth's rotation axis is Y-up, which matches Three.js default
    // Rotate so 0° longitude (prime meridian) faces +X
    this.mesh.rotation.y = -Math.PI / 2;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
