import * as THREE from 'three';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ScreenPosition {
  x: number;
  y: number;
  zDepth: number;
  visible: boolean;
}

const EARTH_RADIUS_KM = 6371;

export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

export function vector3ToLatLng(point: THREE.Vector3): GeoPoint {
  const normalized = point.clone().normalize();
  const lat = 90 - (Math.acos(normalized.y) * 180) / Math.PI;
  const lng = (Math.atan2(-normalized.x, normalized.z) * 180) / Math.PI - 180;
  return { lat, lng };
}

export function getScreenPosition(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer
): ScreenPosition {
  const pos = worldPos.clone();
  pos.project(camera);

  const widthHalf = renderer.domElement.clientWidth / 2;
  const heightHalf = renderer.domElement.clientHeight / 2;

  const x = pos.x * widthHalf + widthHalf;
  const y = -(pos.y * heightHalf) + heightHalf;

  const normal = worldPos.clone().normalize();
  const cameraDir = new THREE.Vector3()
    .subVectors(camera.position, worldPos)
    .normalize();
  const isFrontFacing = normal.dot(cameraDir) > 0.15;

  return {
    x,
    y,
    zDepth: pos.z,
    visible: isFrontFacing && pos.z < 1,
  };
}

export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = EARTH_RADIUS_KM;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const c =
    2 *
    Math.asin(
      Math.sqrt(
        sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
      )
    );

  return R * c;
}

export function lerpPosition(
  current: { x: number; y: number },
  target: { x: number; y: number },
  factor: number
): { x: number; y: number } {
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor,
  };
}