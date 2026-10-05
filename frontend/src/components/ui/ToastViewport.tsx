import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { dismissToast, useToasts } from '@/hooks/use-toast';

export function ToastViewport() {
  const notices = useToasts();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[300] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-relevant="additions">
      {notices.map((notice) => {
        const isError = notice.variant === 'destructive';
        const Icon = isError ? AlertCircle : CheckCircle2;
        return (
          <div
            key={notice.id}
            role={isError ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-3 border px-3.5 py-3 shadow-xl backdrop-blur"
            style={{
              background: 'var(--bg-overlay)',
              borderColor: isError ? 'rgba(239,68,68,0.35)' : 'var(--border-muted)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
            }}
          >
            <Icon size={17} className="mt-0.5 shrink-0" color={isError ? 'var(--status-err)' : 'var(--status-ok)'} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {notice.title && <p className="text-sm font-semibold">{notice.title}</p>}
              {notice.description && <p className="mt-0.5 break-words text-xs" style={{ color: 'var(--text-secondary)' }}>{notice.description}</p>}
            </div>
            <button type="button" onClick={() => dismissToast(notice.id)} aria-label="Dismiss notification" className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}