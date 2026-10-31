import React, { useEffect, useState } from 'react';
import type { WidgetSpec } from '@/services/types';
import { fetchWidgetData } from '@/services/dashboardService';
import WidgetCard from './WidgetCard';
import { getWidgetDefinition } from './widgetRegistry';

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
  const definition = getWidgetDefinition(resolved.type);

  if (!definition) {
    // Not in WIDGET_REGISTRY → rejected. Show it so the user can delete it.
    return (
      <WidgetCard widget={resolved} {...actions}>
        <div className="h-full flex items-center justify-center p-4 text-xs text-center" style={{ color: '#f87171' }}>
          Unsupported widget type "{String(resolved.type)}"
        </div>
      </WidgetCard>
    );
  }

  const Component = definition.component;
  return <Component widget={resolved} onRowClick={handleRowClick} actions={actions} />;
}
