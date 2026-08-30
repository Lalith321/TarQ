import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Globe } from './globe';
import {
  LAND_COORDINATES,
  SNAP_RADIUS_PX,
  ARC_ORIGIN_POINTS,
  CARD_TEMPLATES,
  type CardTemplate,
  type LatLng,
} from './globeCards';

interface Props {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  globe: Globe;
}

interface VisualCard {
  key: string;
  template: CardTemplate;
  slotIndex: number;
}

interface CardState {
  id: string;
  hubLocal: THREE.Vector3;
  opacity: number;
  targetOpacity: number;
  arcs: THREE.Vector3[][];
  arcOriginLocal: THREE.Vector3[];
  visualCards: VisualCard[];
}

const LERP_OPACITY = 0.08;
const ARC_SAMPLES = 18;
const MIN_ARCS = 3;
const MAX_ARCS = 5;
const MIN_CARDS = 6;
const MAX_CARDS = 8;

const DOCK_SLOTS: { xf: number; yf: number }[] = [
  { xf: 0.08, yf: 0.20 }, { xf: 0.92, yf: 0.20 },
  { xf: 0.14, yf: 0.34 }, { xf: 0.86, yf: 0.34 },
  { xf: 0.06, yf: 0.48 }, { xf: 0.94, yf: 0.48 },
  { xf: 0.18, yf: 0.60 }, { xf: 0.82, yf: 0.60 },
];

function pickSlots(usedSlots: Set<number>, count: number): number[] {
  const available = DOCK_SLOTS.map((_, i) => i).filter((i) => !usedSlots.has(i));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

function localSpherePos(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Bulges the arc outward along the sphere's radial direction, like a flight path
function buildArcLocalPoints(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const height = a.distanceTo(b) * 0.35;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const t = i / ARC_SAMPLES;
    const p = a.clone().lerp(b, t);
    const lift = Math.sin(Math.PI * t) * height;
    p.add(p.clone().normalize().multiplyScalar(lift));
    pts.push(p);
  }
  return pts;
}

function pickArcOrigins(): LatLng[] {
  const count = MIN_ARCS + Math.floor(Math.random() * (MAX_ARCS - MIN_ARCS + 1));
  const pool = [...ARC_ORIGIN_POINTS];
  const picked: LatLng[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

function pickCardTemplates(): CardTemplate[] {
  const count = MIN_CARDS + Math.floor(Math.random() * (MAX_CARDS - MIN_CARDS + 1));
  const pool = [...CARD_TEMPLATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function smoothstep(x: number, edge0: number, edge1: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function CardContent({ data }: { data: CardTemplate }) {
  switch (data.type) {
    case 'bar':
      return (
        <>
          <div className="card-title">{data.title}</div>
          <svg width="90" height="35" viewBox="0 0 90 35" style={{ marginTop: 4 }}>
            <rect x="2" y="18" width="8" height="15" fill="rgba(0,212,255,0.5)" rx="1"/>
            <rect x="14" y="10" width="8" height="23" fill="rgba(0,212,255,0.6)" rx="1"/>
            <rect x="26" y="22" width="8" height="11" fill="rgba(0,212,255,0.35)" rx="1"/>
            <rect x="38" y="5" width="8" height="28" fill="rgba(0,212,255,0.7)" rx="1"/>
            <rect x="50" y="14" width="8" height="19" fill="rgba(0,212,255,0.55)" rx="1"/>
            <rect x="62" y="8" width="8" height="25" fill="rgba(0,212,255,0.65)" rx="1"/>
            <rect x="74" y="20" width="8" height="13" fill="rgba(0,212,255,0.4)" rx="1"/>
          </svg>
          <div style={{ fontSize: '0.55rem', marginTop: 4, color: 'rgba(140,210,255,0.7)' }}>{data.val}</div>
        </>
      );
    case 'line':
      return (
        <>
          <div className="card-title">{data.title}</div>
          <svg width="85" height="32" viewBox="0 0 85 32" style={{ marginTop: 4 }}>
            <polyline points="0,26 12,20 24,24 36,12 48,16 60,8 72,10 85,6" fill="none" stroke="rgba(0,212,255,0.6)" strokeWidth="1.5"/>
            <polyline points="0,30 12,26 24,28 36,22 48,24 60,18 72,20 85,16" fill="none" stroke="rgba(120,80,255,0.4)" strokeWidth="1.2"/>
          </svg>
          <div style={{ fontSize: '0.55rem', marginTop: 4, color: 'rgba(140,210,255,0.7)' }}>{data.val}</div>
        </>
      );
    case 'pie':
      return (
        <>
          <div className="card-title">{data.title}</div>
          <svg width="40" height="40" viewBox="0 0 40 40" style={{ marginTop: 4 }}>
            <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(0,212,255,0.5)" strokeWidth="6" strokeDasharray="40 100"/>
            <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(120,80,255,0.4)" strokeWidth="6" strokeDasharray="28 100" strokeDashoffset="-40"/>
            <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(0,200,150,0.3)" strokeWidth="6" strokeDasharray="20 100" strokeDashoffset="-68"/>
          </svg>
          <div style={{ fontSize: '0.55rem', marginTop: 4, color: 'rgba(140,210,255,0.7)' }}>{data.val}</div>
        </>
      );
    case 'table':
      return (
        <>
          <div className="card-title">{data.title}</div>
          <table style={{ fontSize: '0.5rem', marginTop: 4, width: '100%' }}>
            <tbody>
              <tr>
                <th style={{ color: 'rgba(140,210,255,0.7)', textAlign: 'left', padding: '1px 4px', borderBottom: '1px solid rgba(80,160,255,0.15)' }}>M</th>
                <th style={{ color: 'rgba(140,210,255,0.7)', textAlign: 'left', padding: '1px 4px', borderBottom: '1px solid rgba(80,160,255,0.15)' }}>V</th>
                <th style={{ color: 'rgba(140,210,255,0.7)', textAlign: 'left', padding: '1px 4px', borderBottom: '1px solid rgba(80,160,255,0.15)' }}>D</th>
              </tr>
              <tr><td style={{ padding: '1px 4px', color: 'rgba(160,200,255,0.6)' }}>Rev</td><td style={{ padding: '1px 4px', color: 'rgba(160,200,255,0.6)' }}>$2.4</td><td style={{ padding: '1px 4px', color: '#4ade80' }}>+12</td></tr>
              <tr><td style={{ padding: '1px 4px', color: 'rgba(160,200,255,0.6)' }}>Usr</td><td style={{ padding: '1px 4px', color: 'rgba(160,200,255,0.6)' }}>1.8M</td><td style={{ padding: '1px 4px', color: '#4ade80' }}>+8</td></tr>
            </tbody>
          </table>
          <div style={{ fontSize: '0.5rem', marginTop: 2, color: 'rgba(140,210,255,0.5)' }}>{data.val}</div>
        </>
      );
    case 'json':
      return (
        <>
          <div className="card-title">{data.title}</div>
          <div style={{ fontSize: '0.5rem', marginTop: 4, color: 'rgba(150,200,255,0.6)', lineHeight: 1.4 }}>
            {'{'}"status": "ok",<br/>
            &nbsp;&nbsp;"val": "{data.val}",<br/>
            &nbsp;&nbsp;"live": true{'}'}
          </div>
        </>
      );
    case 'text':
      return (
        <>
          <div className="card-title">{data.title}</div>
          <div style={{ fontSize: '0.55rem', marginTop: 4, color: 'rgba(160,210,255,0.75)' }}>
            {data.val}
          </div>
          <div style={{ fontSize: '0.45rem', marginTop: 2, color: 'rgba(140,200,255,0.4)' }}>
            SELECT * FROM events<br/>WHERE status = 'active'
          </div>
        </>
      );
    case 'metric':
    default:
      return (
        <>
          <div className="card-title">{data.title}</div>
          <strong style={{ fontSize: '0.85rem', color: 'rgba(200,235,255,1)' }}>{data.val}</strong>
        </>
      );
  }
}

export const GlobeHoverCards: React.FC<Props> = ({ camera, renderer, globe }) => {
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const cardsRef = useRef<Map<string, CardState>>(new Map());
  const usedSlotsRef = useRef<Set<number>>(new Set());
  const [, setFrame] = useState(0); // bump to force re-render each tick

  useEffect(() => {
    const canvas = renderer.domElement;
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [renderer]);

  useEffect(() => {
    let animId: number;
    const { mesh, radius } = globe;

    const tick = () => {
      mesh.updateMatrixWorld();

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const wHalf = renderer.domElement.clientWidth / 2;
      const hHalf = renderer.domElement.clientHeight / 2;
      const current = cardsRef.current;
      const hovered = new Set<string>();

      for (const point of LAND_COORDINATES) {
        const localPos = localSpherePos(point.lat, point.lng, radius);
        const worldPos = localPos.clone().applyMatrix4(mesh.matrixWorld);
        const sp = worldPos.clone().project(camera);
        const sx = sp.x * wHalf + wHalf;
        const sy = -(sp.y * hHalf) + hHalf;

        const worldNormal = localPos.clone().normalize().transformDirection(mesh.matrixWorld);
        const toCam = new THREE.Vector3().subVectors(camera.position, worldPos).normalize();
        const front = worldNormal.dot(toCam) > 0.12;

        if (!front || sp.z > 1) continue;

        const dx = sx - mx;
        const dy = sy - my;
        if (dx * dx + dy * dy <= SNAP_RADIUS_PX * SNAP_RADIUS_PX) {
          hovered.add(point.id);

          const existing = current.get(point.id);
          if (existing) {
            existing.targetOpacity = 1;
          } else {
            const hubLocal = localPos;
            const origins = pickArcOrigins();
            const arcs = origins.map((o) => buildArcLocalPoints(localSpherePos(o.lat, o.lng, radius), hubLocal));
            const arcOriginLocal = origins.map((o) => localSpherePos(o.lat, o.lng, radius));

            const templates = pickCardTemplates();
            const slots = pickSlots(usedSlotsRef.current, templates.length);
            slots.forEach((s) => usedSlotsRef.current.add(s));
            const visualCards: VisualCard[] = templates.map((template, idx) => ({
              key: `${point.id}-${idx}`,
              template,
              slotIndex: slots[idx] ?? 0,
            }));

            current.set(point.id, {
              id: point.id,
              hubLocal,
              opacity: 0,
              targetOpacity: 1,
              arcs,
              arcOriginLocal,
              visualCards,
            });
          }
        }
      }

      for (const [id, card] of current) {
        if (!hovered.has(id)) card.targetOpacity = 0;
        card.opacity += (card.targetOpacity - card.opacity) * LERP_OPACITY;
        if (card.opacity < 0.005 && card.targetOpacity === 0) {
          card.visualCards.forEach((vc) => usedSlotsRef.current.delete(vc.slotIndex));
          current.delete(id);
        }
      }

      setFrame((f) => f + 1);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [camera, renderer, globe]);

  const { mesh } = globe;
  const wHalf = renderer.domElement.clientWidth / 2;
  const hHalf = renderer.domElement.clientHeight / 2;
  const toScreen = (p: THREE.Vector3) => {
    const world = p.clone().applyMatrix4(mesh.matrixWorld);
    const sp = world.clone().project(camera);
    return { x: sp.x * wHalf + wHalf, y: -(sp.y * hHalf) + hHalf };
  };

  const cards = Array.from(cardsRef.current.values());

  return (
    <div className="globe-hover-cards">
      <svg className="card-connectors">
        {cards.map((card) =>
          card.arcs.map((arcPts, i) => {
            const originLocal = card.arcOriginLocal[i];
            const originWorldNormal = originLocal.clone().normalize().transformDirection(mesh.matrixWorld);
            const originWorld = originLocal.clone().applyMatrix4(mesh.matrixWorld);
            const toCam = new THREE.Vector3().subVectors(camera.position, originWorld).normalize();
            const frontAlpha = smoothstep(originWorldNormal.dot(toCam), -0.05, 0.15);
            const opacity = card.opacity * frontAlpha;
            if (opacity < 0.01) return null;

            const screenPts = arcPts.map(toScreen);
            const d = screenPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const originScreen = screenPts[0];

            return (
              <g key={`${card.id}-arc-${i}`} style={{ opacity }}>
                <path d={d} className="arc-line" />
                <circle cx={originScreen.x} cy={originScreen.y} r="2" className="arc-origin-dot" />
              </g>
            );
          })
        )}
        {cards.map((card) => {
          const hub = toScreen(card.hubLocal);
          return (
            <circle
              key={`${card.id}-dot`}
              cx={hub.x}
              cy={hub.y}
              r="3"
              className="card-anchor-dot"
              style={{ opacity: card.opacity }}
            />
          );
        })}
      </svg>

      {cards.flatMap((card) =>
        card.visualCards.map((vc) => {
          const slot = DOCK_SLOTS[vc.slotIndex];
          const dockX = slot.xf * window.innerWidth;
          const dockY = slot.yf * window.innerHeight;
          const sizeClass = `card-${vc.template.priority}`;
          return (
            <div
              key={vc.key}
              className={`data-card hover-card ${sizeClass}`}
              style={{
                left: dockX,
                top: dockY,
                opacity: card.opacity,
                transform: `translate(-50%, -100%) scale(${0.85 + card.opacity * 0.15})`,
              }}
            >
              <CardContent data={vc.template} />
            </div>
          );
        })
      )}
    </div>
  );
};