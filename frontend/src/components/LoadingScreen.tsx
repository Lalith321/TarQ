import { useEffect, useState } from 'react';

interface Props {
  onDone: () => void;
}

export function LoadingScreen({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Quickly ramp progress to 100 over ~800 ms, then fade out
    const start = performance.now();
    const duration = 800;

    const raf = (ts: number) => {
      const elapsed = ts - start;
      const p = Math.min(elapsed / duration, 1);
      // ease-out curve
      setProgress(Math.round(p * p * (3 - 2 * p) * 100));

      if (p < 1) {
        requestAnimationFrame(raf);
      } else {
        // Trigger fade then unmount
        setFade(true);
        setTimeout(onDone, 350);
      }
    };

    requestAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base, #07080f)',
        transition: 'opacity 0.35s ease',
        opacity: fade ? 0 : 1,
        pointerEvents: fade ? 'none' : 'all',
      }}
    >
      {/* Logo mark */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        style={{ marginBottom: '24px', filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.6))' }}
      >
        <polygon
          points="12,2 21,7 21,17 12,22 3,17 3,7"
          stroke="url(#load-lg)"
          strokeWidth="1.5"
          fill="rgba(59,130,246,0.12)"
        />
        <circle cx="12" cy="12" r="3" fill="url(#load-lg)" />
        <defs>
          <linearGradient id="load-lg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>

      {/* Wordmark */}
      <span
        style={{
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '32px',
        }}
      >
        TarQ
      </span>

      {/* Progress bar track */}
      <div
        style={{
          width: '160px',
          height: '2px',
          borderRadius: '9999px',
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            borderRadius: '9999px',
            background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
            transition: 'width 0.05s linear',
            boxShadow: '0 0 8px rgba(59,130,246,0.7)',
          }}
        />
      </div>
    </div>
  );
}
