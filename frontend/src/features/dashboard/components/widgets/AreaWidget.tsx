import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';

export default function AreaWidget({ widget }: { widget: WidgetSpec }) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const gradientId = `grad-${widget.id}`;

  return (
    <WidgetCard widget={widget}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={widget.data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={widget.color ?? 'hsl(var(--primary))'} stopOpacity={0.25} />
              <stop offset="95%" stopColor={widget.color ?? 'hsl(var(--primary))'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
          <XAxis dataKey={widget.x_field} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 10,
              border: '1px solid hsl(var(--border))',
            }}
          />
          <Area
            type="monotone"
            dataKey={yField}
            stroke={widget.color ?? 'hsl(var(--primary))'}
            strokeWidth={3}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
