import React, { useEffect, useState } from 'react';
import type { WidgetSpec } from '@/services/types';
import { fetchWidgetData } from '@/services/dashboardService';
import BarWidget from './BarWidget';
import LineWidget from './LineWidget';
import PieWidget from './PieWidget';
import AreaWidget from './AreaWidget';
import TableWidget from './TableWidget';
import StatWidget from './StatWidget';
import GisWidget from './GisWidget';

export interface WidgetActions {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onFullscreen?: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

interface Props {
  widget: WidgetSpec;
  onDrillDown?: (widget: WidgetSpec, row: Record<string, any>) => void;
  dashboardId?: string;
  refreshKey?: number;
  actions?: WidgetActions;
}

function useWidgetData(widget: WidgetSpec, dashboardId?: string, refreshKey = 0): WidgetSpec {
  const needsFetch = Boolean(widget.sql_query && widget.sql_connection && dashboardId);
  const [data, setData] = useState<Record<string, any>[] | null>(null);

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    fetchWidgetData(dashboardId!, widget.id)
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, [needsFetch, dashboardId, widget.id, widget.sql_query, widget.sql_connection, refreshKey]);

  if (!needsFetch) return widget;
  return { ...widget, data: data ?? [] };
}

export default function WidgetRenderer({ widget, onDrillDown, dashboardId, refreshKey, actions }: Props) {
  const resolved = useWidgetData(widget, dashboardId, refreshKey);
  const handleRowClick = (row: Record<string, any>) => onDrillDown?.(resolved, row);

  switch (resolved.type) {
    case 'bar':
      return <BarWidget widget={resolved} onRowClick={handleRowClick} actions={actions} />;
    case 'line':
    case 'multi_line':
      return <LineWidget widget={resolved} actions={actions} />;
    case 'pie':
      return <PieWidget widget={resolved} actions={actions} />;
    case 'area':
      return <AreaWidget widget={resolved} actions={actions} />;
    case 'table':
      return <TableWidget widget={resolved} onRowClick={handleRowClick} actions={actions} />;
    case 'stat':
      return <StatWidget widget={resolved} actions={actions} />;
    case 'gis':
      return <GisWidget widget={resolved} onRowClick={handleRowClick} />;
    default:
      return (
        <div className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          Unknown widget type: {(resolved as any).type}
        </div>
      );
  }
}
