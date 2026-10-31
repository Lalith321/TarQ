import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

function compactNum(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

export default function AreaWidget({ widget, actions }: { widget: WidgetSpec; actions?: WidgetActions }) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const color = widget.color ?? widgetColor(widget.id);
  const gid = `ag-${widget.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const stats = useMemo(() => {
    const nums = (widget.data ?? [])
      .map((r) => Number(r?.[yField]))
      .filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    const total = nums.reduce((a, b) => a + b, 0);
    const max = Math.max(...nums);
    return { total: compactNum(total), max: compactNum(max), latest: compactNum(nums[nums.length - 1]) };
  }, [widget.data, yField]);

  return (
    <WidgetCard widget={widget} {...actions}>
      {stats && (
        <div className="widget-metrics-strip">
          <span className="widget-metric-chip">Total <strong>{stats.total}</strong></span>
          <span className="widget-metric-chip">Peak <strong>{stats.max}</strong></span>
          <span className="widget-metric-chip">Latest <strong>{stats.latest}</strong></span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={widget.data} margin={{ top: 6, right: 8, left: -8, bottom: 2 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="65%" stopColor={color} stopOpacity={0.14} />
                <stop offset="100%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
            <XAxis
              dataKey={widget.x_field}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
            />
            <YAxis
              tickFormatter={compactNum}
              width={46}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: any) => [compactNum(value), yField]}
              contentStyle={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-muted)',
                borderRadius: 10,
                fontSize: 11,
                color: 'var(--text-primary)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
              }}
            />
            <Area
              type="monotone"
              dataKey={yField}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gid})`}
              isAnimationActive={false}
              activeDot={{ r: 5, fill: color, stroke: 'var(--bg-surface)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

