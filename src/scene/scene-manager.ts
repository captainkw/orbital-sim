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
    this.renderer.domElement.style.touchAction = 'none';
    document.body.prepend(this.renderer.domElement);

    // Camera starts at north pole, looking down
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1e-6,
      10000
    );
    this.camera.position.set(0, 20, 0);
    this.camera.up.set(0, 0, -1); // So "up" in view aligns with -Z (toward launch point)
    this.camera.lookAt(0, 0, 0);

    // OrbitControls — mouse only
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    // Closest zoom: 20 m from camera target.
    // SCALE = 1e-6 => 20 m * SCALE = 0.00002 scene units.
    this.controls.minDistance = 0.00002;
    this.controls.maxDistance = 500;
    this.controls.listenToKeyEvents = undefined as any; // disable keyboard panning

    // Mobile: enable pan and 2-finger dolly+pan
    if ('ontouchstart' in window) {
      this.controls.enablePan = true;
      this.controls.screenSpacePanning = true;
      this.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      // Slightly wider default framing on mobile so orbit arc fits better.
      this.camera.position.set(0, 24, 0);
    }

    // Background
    this.scene.background = new THREE.Color(0x000000);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
