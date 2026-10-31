import * as THREE from 'three';

export interface NodeData {
  position: THREE.Vector3;
  worldPos: THREE.Vector3;
  size: number;
  intensity: number;
  isHub: boolean;
  id: number;
  active: boolean;
}

export interface ConnectionData {
  from: number;
  to: number;
  intensity: number;
}

export interface SplineData {
  curve: THREE.CatmullRomCurve3;
  tube: THREE.Mesh;
  tubeMaterial: THREE.MeshBasicMaterial;
  particleSystem: THREE.Points;
  particleGeometry: THREE.BufferGeometry;
  progress: number;
  speed: number;
  fadeIn: number;
  fadeOut: boolean;
  sourceNode: NodeData;
}

export interface FloatingObject {
  mesh: THREE.Sprite;
  material: THREE.SpriteMaterial;
  basePos: THREE.Vector3;
  driftSpeed: number;
  driftOffset: number;
  rotSpeed: number;
  type: string;
}

export interface HubSprite {
  sprite: THREE.Sprite;
  node: NodeData;
}

export interface InfographicData {
  title: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  chartData: number[];
}

export type CursorState = 'default' | 'hover' | 'active';
export type InfographicType = 'line' | 'bar' | 'kpi' | 'distribution';