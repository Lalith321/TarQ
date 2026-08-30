import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';

const PALETTE = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-1))',
];

export default function PieWidget({ widget }: { widget: WidgetSpec }) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';

  return (
    <WidgetCard widget={widget}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={widget.data}
            dataKey={yField}
            nameKey={widget.x_field}
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
          >
            {widget.data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 10,
              border: '1px solid hsl(var(--border))',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
