import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';
import { buildLineChartModel } from '@/lib/lineChartData';

const MULTI = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];

export default function LineWidget({ widget, actions }: { widget: WidgetSpec; actions?: WidgetActions }) {
  const chart = buildLineChartModel(widget.data, widget.x_field ?? 'x', widget.y_field, widget.group_by);
  const base = widget.color ?? widgetColor(widget.id);
  return (
    <WidgetCard widget={widget} {...actions}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey={widget.x_field} tick={{ fill: '#6b7590', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="number" domain={['auto', 'auto']} width={56} tick={{ fill: '#6b7590', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: '#0e1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
          {chart.series.length > 1 && <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />}
          {chart.series.map(({ key, name }, index) => (
            <Line key={key} name={name} type="monotone" dataKey={key} stroke={chart.series.length === 1 ? base : MULTI[index % MULTI.length]}
              strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
