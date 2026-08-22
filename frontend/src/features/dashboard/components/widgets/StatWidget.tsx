import React from 'react';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';

export default function StatWidget({ widget }: { widget: WidgetSpec }) {
  const row = widget.data[0] ?? {};
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const value = row[yField];

  return (
    <WidgetCard widget={widget}>
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <p className="text-4xl font-black" style={{ color: widget.color ?? 'hsl(var(--primary))' }}>
          {value ?? '—'}
        </p>
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
          {widget.title}
        </p>
      </div>
    </WidgetCard>
  );
}
