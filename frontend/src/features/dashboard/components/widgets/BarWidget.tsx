import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
}

export default function BarWidget({ widget, onRowClick }: Props) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const clickable = Boolean(widget.drill_down?.enabled && onRowClick);

  return (
    <WidgetCard widget={widget}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={widget.data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
          <XAxis
            dataKey={widget.x_field}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 10,
              border: '1px solid hsl(var(--border))',
            }}
          />
          <Bar
            dataKey={yField}
            fill={widget.color ?? 'hsl(var(--primary))'}
            radius={[6, 6, 0, 0]}
            cursor={clickable ? 'pointer' : undefined}
            onClick={(data) => clickable && onRowClick?.(data as Record<string, any>)}
          />
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
