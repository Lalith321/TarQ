import React from 'react';
import type { WidgetSpec } from '@/services/types';
import BarWidget from './BarWidget';
import LineWidget from './LineWidget';
import PieWidget from './PieWidget';
import AreaWidget from './AreaWidget';
import TableWidget from './TableWidget';
import StatWidget from './StatWidget';
import GisWidget from './GisWidget';

interface Props {
  widget: WidgetSpec;
  onDrillDown?: (widget: WidgetSpec, row: Record<string, any>) => void;
}

/**
 * The single place that maps `widget.type` to a component. This replaces
 * the original PlatformDashboard's approach of hand-writing each chart
 * inline — adding a new widget type now means adding one case here, not
 * touching the page component at all.
 */
export default function WidgetRenderer({ widget, onDrillDown }: Props) {
  const handleRowClick = (row: Record<string, any>) => onDrillDown?.(widget, row);

  switch (widget.type) {
    case 'bar':
      return <BarWidget widget={widget} onRowClick={handleRowClick} />;
    case 'line':
      return <LineWidget widget={widget} />;
    case 'pie':
      return <PieWidget widget={widget} />;
    case 'area':
      return <AreaWidget widget={widget} />;
    case 'table':
      return <TableWidget widget={widget} onRowClick={handleRowClick} />;
    case 'stat':
      return <StatWidget widget={widget} />;
    case 'gis':
      return <GisWidget widget={widget} onRowClick={handleRowClick} />;
    default:
      return (
        <div className="p-4 text-xs text-muted-foreground">
          Unknown widget type: {widget.type}
        </div>
      );
  }
}
