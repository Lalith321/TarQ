import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

const PALETTE = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#f97316'];

export default function PieWidget({ widget, actions }: { widget: WidgetSpec; actions?: WidgetActions }) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const base = widget.color ?? widgetColor(widget.id);
  const baseIdx = PALETTE.indexOf(base);
  const colors = PALETTE.slice(baseIdx >= 0 ? baseIdx : 0).concat(PALETTE.slice(0, baseIdx >= 0 ? baseIdx : 0));
  return (
    <WidgetCard widget={widget} {...actions}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={widget.data} dataKey={yField} nameKey={widget.x_field}
            innerRadius="45%" outerRadius="75%" paddingAngle={3}>
            {widget.data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#0e1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#6b7590' }} />
        </PieChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
