import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';

export default function LineWidget({ widget }: { widget: WidgetSpec }) {
  const fields = Array.isArray(widget.y_field) ? widget.y_field : [widget.y_field ?? 'value'];
  const palette = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  return (
    <WidgetCard widget={widget}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={widget.data}>
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
          {fields.map((f, i) => (
            <Line
              key={f}
              type="monotone"
              dataKey={f}
              stroke={palette[i % palette.length]}
              strokeWidth={2.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
