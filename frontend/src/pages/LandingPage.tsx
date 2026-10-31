import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { Globe } from '../features/hero/globe';
import { GlobeHoverCards } from '../features/hero/GlobeHoverCards';
import { GlobeCursorDecal } from '../features/hero/GlobeCursorDecal';
import './LandingPage.css';

export function LandingPage() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeRef    = useRef<Globe | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07080f, 0.004);

    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 32);
    camera.lookAt(0, -4, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x07080f, 1);
    rendererRef.current = renderer;

    const globe = new Globe(scene);
    globeRef.current = globe;
    setReady(true);

    scene.add(new THREE.AmbientLight(0x0a1a2a, 0.5));
    const key = new THREE.PointLight(0x00d4ff, 0.8, 100);
    key.position.set(20, 30, 20);
    scene.add(key);
    const fill = new THREE.PointLight(0x2244aa, 0.4, 120);
    fill.position.set(-30, 10, -30);
    scene.add(fill);

    const clock = new THREE.Clock();
    const cursorDecal = new GlobeCursorDecal(scene, camera, renderer, globe);

    function animate() {
      requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const dt   = clock.getDelta();
      cursorDecal.update(time);
      globe.update(time, dt);
      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cursorDecal.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="landing">
      <canvas ref={canvasRef} className="landing-canvas" />

      {ready && cameraRef.current && rendererRef.current && globeRef.current && (
        <GlobeHoverCards
          camera={cameraRef.current}
          renderer={rendererRef.current}
          globe={globeRef.current}
        />
      )}

      <div className="landing-vignette-bottom" />
      <div className="landing-vignette-radial" />
      <div className="landing-vignette-top" />

      {/* Nav */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="nav-brand-icon">
            <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" stroke="url(#lg)" strokeWidth="1.5" fill="rgba(59,130,246,0.1)"/>
            <circle cx="12" cy="12" r="3" fill="url(#lg)"/>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
          TarQ
        </div>
        <div className="nav-links">
          <a href="#analysis">Analysis</a>
          <a href="#insights">Insights</a>
          <a href="#ml">ML</a>
          <a href="#docs">Docs</a>
          <Link to="/signin" className="nav-cta">Sign in</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="landing-hero">
        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot" />
          AI-Powered Data Intelligence
        </div>

        <h1>
          Turn raw data into<br />
          <strong>clear business insight.</strong>
        </h1>

        <p>
          Explore datasets, ask questions in plain language, and let your
          agent fleet surface the signals that matter.
        </p>

        <div className="hero-actions">
          <Link to="/app/analyst" className="hero-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Open Analysis
          </Link>
        </div>
      </div>
    </div>
  );
}
