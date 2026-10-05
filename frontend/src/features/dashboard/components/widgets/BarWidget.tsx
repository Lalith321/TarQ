import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

interface Props { widget: WidgetSpec; onRowClick?: (row: Record<string, any>) => void; actions?: WidgetActions; }

export default function BarWidget({ widget, onRowClick, actions }: Props) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const color = widget.color ?? widgetColor(widget.id);
  const clickable = Boolean(widget.drill_down?.enabled && onRowClick);
  return (
    <WidgetCard widget={widget} {...actions}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={widget.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey={widget.x_field} tick={{ fill: '#6b7590', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6b7590', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: '#0e1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey={yField} radius={[4, 4, 0, 0]} cursor={clickable ? 'pointer' : undefined}
            onClick={(data) => clickable && onRowClick?.(data as Record<string, any>)}>
            {widget.data.map((_, i) => <Cell key={i} fill={color} fillOpacity={0.85 + (i % 3) * 0.05} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
