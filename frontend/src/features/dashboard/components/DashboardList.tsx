import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboards } from '../hooks/useDashboards';
import { useToast } from '@/hooks/use-toast';
import type { DashboardSpec } from '@/services/types';

function DashboardCard({ dashboard, onClick, onDelete }: {
  dashboard: DashboardSpec;
  onClick: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const widgets = dashboard.widgets ?? [];
  const widgetCount = widgets.length;

  return (
    <div
      onClick={() => onClick(dashboard.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(dashboard.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open dashboard ${dashboard.title}`}
      className="group relative flex cursor-pointer flex-col justify-between rounded-lg border border-transparent p-5 transition-colors duration-200 hover:bg-white/[0.035]"
      style={{
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(dashboard.id); }}
          className="absolute right-3 top-3 rounded-lg p-1.5 opacity-100 transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--status-err)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          title="Delete dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      )}

      <div>
        <h3 className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>
          {dashboard.title}
        </h3>
        {dashboard.description && (
          <p className="mt-1 text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {dashboard.description}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        {widgetCount} {widgetCount === 1 ? 'widget' : 'widgets'}
      </div>
    </div>
  );
}

interface Props {
  builderRoute?: string;
}

export function DashboardList({ builderRoute = '/dashboard/builder' }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dashboards, loading, error, create, remove } = useDashboards();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await create({ title: 'Untitled Dashboard' });
      navigate(`${builderRoute}?id=${created.id}&new=1`);
    } catch (cause) {
      toast({ title: 'Could not create dashboard', description: cause instanceof Error ? cause.message : 'Please try again.' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
    } catch (cause) {
      toast({ title: 'Could not delete dashboard', description: cause instanceof Error ? cause.message : 'Please try again.' });
    }
  };

  const handleOpen = (id: string) => {
    navigate(`${builderRoute}?id=${id}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl" style={{ background: 'var(--bg-raised)' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: 'var(--status-err)' }}>
        Failed to load dashboards: {error}
      </div>
    );
  }

  const items = Array.isArray(dashboards) ? dashboards : [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Create card */}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="group flex h-32 flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-white/[0.12] text-slate-500 transition-colors duration-200 hover:border-primary/30 hover:bg-white/[0.025] hover:text-slate-200"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-all" style={{ background: 'var(--bg-raised)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className="text-xs font-medium">{creating ? 'Creating…' : 'New dashboard'}</span>
      </button>

      {items.map((dashboard) => (
        <DashboardCard key={dashboard.id} dashboard={dashboard} onClick={handleOpen} onDelete={handleDelete} />
      ))}
    </div>
  );
}