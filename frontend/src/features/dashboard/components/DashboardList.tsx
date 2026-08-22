import { useNavigate } from 'react-router-dom';
import { useDashboards } from '../hooks/useDashboards';
import { Card } from '@/components/ui/card';
import type { DashboardSpec } from '@/services/types';

function DashboardCard({ dashboard, onClick, onDelete }: {
  dashboard: DashboardSpec;
  onClick: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const widgets = dashboard.widgets ?? [];
  const widgetCount = widgets.length;

  return (
    <Card
      onClick={() => onClick(dashboard.id)}
      className="group relative flex flex-col justify-between p-5 cursor-pointer hover:shadow-md transition-shadow"
    >
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(dashboard.id);
          }}
          className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          title="Delete dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      )}

      <div>
        <h3 className="text-base font-semibold text-foreground line-clamp-1">
          {dashboard.title}
        </h3>
        {dashboard.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {dashboard.description}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>
          {widgetCount} {widgetCount === 1 ? 'widget' : 'widgets'}
        </span>
      </div>
    </Card>
  );
}

interface Props {
  builderRoute?: string;
}

export function DashboardList({ builderRoute = '/dashboard/builder' }: Props) {
  const navigate = useNavigate();
  const { dashboards, loading, error, create, remove } = useDashboards();

  const handleCreate = async () => {
    const created = await create({ title: 'Untitled Dashboard' });
    navigate(`${builderRoute}?id=${created.id}&new=1`);
  };

  const handleOpen = (id: string) => {
    navigate(`${builderRoute}?id=${id}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load dashboards: {error}
      </div>
    );
  }

  const items = Array.isArray(dashboards) ? dashboards : [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <button
        onClick={handleCreate}
        className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-accent hover:text-foreground"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="text-sm font-medium">Create dashboard</span>
      </button>

      {items.map((dashboard) => (
        <DashboardCard
          key={dashboard.id}
          dashboard={dashboard}
          onClick={handleOpen}
          onDelete={remove}
        />
      ))}
    </div>
  );
}