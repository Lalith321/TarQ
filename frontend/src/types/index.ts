export interface HeroInstance {
  destroy: () => void;
}

export function initHero(_container: HTMLElement): HeroInstance {
  return {
    destroy() {
      // Placeholder for compatibility; the real hero initializer lives under src/features/hero.
    },
  };
}

export function destroyHero(): void {
  // Placeholder for compatibility; no-op during build.
}
