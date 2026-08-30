// AnalystPage.tsx
import AnalystPanel from '@/features/analyst/AnalystPanel';

export default function AnalystPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none fixed inset-0 opacity-[0.15]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="pointer-events-none fixed -left-32 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
      <div className="pointer-events-none fixed -right-32 bottom-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">AI Analyst</h1>
            <p className="mt-2 text-sm text-slate-400">Configure your agent fleet and inject analytical prompts.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            System operational
          </div>
        </div>

        <AnalystPanel />
      </div>
    </div>
  );
}