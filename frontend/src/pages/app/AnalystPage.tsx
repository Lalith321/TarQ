import AnalystPanel from '@/features/analyst/AnalystPanel';

export default function AnalystPage() {
  return (
    <div className="relative min-h-full" style={{ color: 'var(--text-primary)' }}>
      {/* Static ambient — no animation, no flicker */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 10% 0%, rgba(59,130,246,0.06) 0%, transparent 70%), ' +
            'radial-gradient(ellipse 50% 35% at 90% 100%, rgba(6,182,212,0.05) 0%, transparent 70%)',
        }}
      />

      {/* Page header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
            TarQ · AI Analyst
          </p>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Agent Fleet
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Configure agents and set behaviour instructions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="relative flex h-2 w-2">
            <span className="inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--status-ok)' }} />
          </span>
          System operational
        </div>
      </div>

      <AnalystPanel />
    </div>
  );
}
