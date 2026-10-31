// src/features/hero/GlobeCursorDecal.ts
import * as THREE from 'three';
import { Globe } from './globe';

const RING_COLOR = 0x00d4ff;

export class GlobeCursorDecal {
  private readonly group: THREE.Group;
  private readonly ring: THREE.Mesh;
  private readonly arc: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2(-2, -2);
  private readonly globeCenter = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly globe: Globe
  ) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const ringMat = new THREE.MeshBasicMaterial({
      color: RING_COLOR,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const arcMat = ringMat.clone();
    arcMat.opacity = 0.75;

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.48, 48), ringMat);
    this.arc = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.63, 48, 1, 0, Math.PI), arcMat);

    this.group.add(this.ring, this.arc);
    this.scene.add(this.group);

    window.addEventListener('mousemove', this.onMouseMove);
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  update(time: number): void {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const [intersection] = this.raycaster.intersectObject(this.globe.mesh, false);

    this.group.visible = !!intersection;
    document.body.classList.toggle('tarq-hide-native-cursor', !!intersection);
    if (!intersection) return;

    this.globe.group.getWorldPosition(this.globeCenter);
    const normal = intersection.point.clone().sub(this.globeCenter).normalize();

    this.group.position.copy(intersection.point).add(normal.clone().multiplyScalar(0.08));
    const baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    this.ring.quaternion.copy(baseQuat).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), time * 1.2)
    );
    this.arc.quaternion.copy(baseQuat).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -time * 0.8)
    );
  }

  dispose(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    document.body.classList.remove('tarq-hide-native-cursor');
    this.scene.remove(this.group);
    this.ring.geometry.dispose();
    this.arc.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    (this.arc.material as THREE.Material).dispose();
  }
}