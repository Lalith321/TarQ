import * as THREE from 'three';

export class SceneManager {
  readonly container: HTMLElement;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly clock: THREE.Clock;
  readonly mouse: THREE.Vector2;
  readonly mouseSmooth: THREE.Vector2;
  private readonly raycaster: THREE.Raycaster;
  private width: number;
  private height: number;
  private readonly dpr: number;

  constructor(container: HTMLElement) {
    this.container = container;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio, 2);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030308);
    this.scene.fog = new THREE.FogExp2(0x030308, 0.015);

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 2, 18);
    this.camera.lookAt(0, -4, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2(-999, -999);
    this.mouseSmooth = new THREE.Vector2(-999, -999);
    this.raycaster = new THREE.Raycaster();

    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', (e: MouseEvent) => this.onMouseMove(e));
  }

  private onResize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  private onMouseMove(e: MouseEvent): void {
    this.mouse.x = (e.clientX / this.width) * 2 - 1;
    this.mouse.y = -(e.clientY / this.height) * 2 + 1;
  }

  updateMouseSmooth(dt: number): void {
    const speed = 3;
    if (this.mouseSmooth.x === -999) {
      this.mouseSmooth.copy(this.mouse);
    } else {
      this.mouseSmooth.x += (this.mouse.x - this.mouseSmooth.x) * speed * dt;
      this.mouseSmooth.y += (this.mouse.y - this.mouseSmooth.y) * speed * dt;
    }
  }

  updateCameraParallax(dt: number): void {
    const intensity = 0.3;
    const targetX = this.mouseSmooth.x * intensity;
    const targetY = this.mouseSmooth.y * intensity + 2;

    this.camera.position.x += (targetX - this.camera.position.x) * 2 * dt;
    this.camera.position.y += (targetY - this.camera.position.y) * 2 * dt;
    this.camera.lookAt(0, -4, 0);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  getRaycaster(): THREE.Raycaster {
    this.raycaster.setFromCamera(this.mouseSmooth, this.camera);
    return this.raycaster;
  }

  projectToScreen(worldPos: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const vec = worldPos.clone();
    vec.project(this.camera);
    return {
      x: (vec.x * 0.5 + 0.5) * this.width,
      y: (-vec.y * 0.5 + 0.5) * this.height,
      visible: vec.z < 1
    };
  }

  destroy(): void {
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}