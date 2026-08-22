import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { Globe } from '../features/hero/globe';
import { GlobeHoverCards } from '../features/hero/GlobeHoverCards';
import './LandingPage.css';

export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeRef = useRef<Globe | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02040a, 0.004);

    const camera = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 4, 32);
    camera.lookAt(0, -4, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x02040a, 1);
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
    function animate() {
      requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const dt = clock.getDelta();
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

      <nav className="landing-nav">
        <div className="nav-brand">Tarq</div>
        <div className="nav-links">
          <a href="#">Analysis</a>
          <a href="#">Insights</a>
          <a href="#">ML</a>
          <a href="#">Docs</a>
        </div>
      </nav>

      <div className="landing-hero">
        <h1>Analyze the signal in your data.</h1>
        <p>Explore datasets, ask questions, and turn raw information into clear business insight.</p>
        <Link to="/app/analyst" className="hero-btn">OPEN ANALYSIS</Link>
      </div>
    </div>
  );
}