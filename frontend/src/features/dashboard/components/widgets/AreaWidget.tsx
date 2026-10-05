import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

export default function AreaWidget({ widget, actions }: { widget: WidgetSpec; actions?: WidgetActions }) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const color = widget.color ?? widgetColor(widget.id);
  const gid = `ag-${widget.id}`;
  return (
    <WidgetCard widget={widget} {...actions}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={widget.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey={widget.x_field} tick={{ fill: '#6b7590', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6b7590', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: '#0e1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
          <Area type="monotone" dataKey={yField} stroke={color} strokeWidth={2.5} fill={`url(#${gid})`} />
        </AreaChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
