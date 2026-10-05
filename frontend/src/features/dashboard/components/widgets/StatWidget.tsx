import React from 'react';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

export default function StatWidget({ widget, actions }: { widget: WidgetSpec; actions?: WidgetActions }) {
  const row = widget.data[0] ?? {};
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const value = row[yField];
  const color = widget.color ?? widgetColor(widget.id);
  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="h-full flex flex-col items-center justify-center gap-1">
        <p className="text-5xl font-black tabular-nums" style={{ color }}>{value ?? '—'}</p>
        <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: '#6b7590' }}>{widget.title}</p>
      </div>
    </WidgetCard>
  );
}
