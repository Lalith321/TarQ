import * as THREE from 'three';
import { SceneManager } from './scene';
import { Globe } from './globe';
import { FloatingData } from './floating-data';

export interface HeroInstance {
  destroy: () => void;
}

export function initHero(container: HTMLElement): HeroInstance {
  const sceneManager = new SceneManager(container);
  const globe = new Globe(sceneManager.scene);
  const floatingData = new FloatingData(sceneManager.scene, sceneManager.camera);

  const clock = new THREE.Clock();
  let rafId: number;

  function loop() {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.getElapsedTime();

    sceneManager.updateMouseSmooth(dt);
    sceneManager.updateCameraParallax(dt);
    globe.update(time, dt);
    floatingData.update(time, dt);
    sceneManager.render();
  }

  loop();

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      sceneManager.destroy();
    },
  };
}