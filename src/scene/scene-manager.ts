import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  constructor() {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.prepend(this.renderer.domElement);

    // Camera starts at north pole, looking down
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      10000
    );
    this.camera.position.set(0, 50, 0);
    this.camera.up.set(0, 0, -1); // So "up" in view aligns with -Z (toward launch point)
    this.camera.lookAt(0, 0, 0);

    // OrbitControls — mouse only
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 500;
    this.controls.listenToKeyEvents = undefined as any; // disable keyboard panning

    // Starfield background
    this.scene.background = new THREE.Color(0x000000);
    this.addStarfield();

    window.addEventListener('resize', this.onResize);
  }

  private addStarfield() {
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 2000;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
    this.scene.add(new THREE.Points(geometry, material));
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
