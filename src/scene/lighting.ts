import * as THREE from 'three';

export function setupLighting(scene: THREE.Scene) {
  // Directional light simulating the Sun
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  sunLight.position.set(50, 20, 30);
  scene.add(sunLight);

  // Ambient light for shadow side visibility
  const ambient = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambient);
}
