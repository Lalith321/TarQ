import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

interface Props { widget: WidgetSpec; onRowClick?: (row: Record<string, any>) => void; actions?: WidgetActions; }

function compactNum(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

export default function BarWidget({ widget, onRowClick, actions }: Props) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const color = widget.color ?? widgetColor(widget.id);
  const clickable = Boolean(widget.drill_down?.enabled && onRowClick);
  const gradId = `bar-grad-${widget.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const stats = useMemo(() => {
    const nums = (widget.data ?? [])
      .map((r) => Number(r?.[yField]))
      .filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    const total = nums.reduce((a, b) => a + b, 0);
    const max = Math.max(...nums);
    const avg = total / nums.length;
    return { total: compactNum(total), max: compactNum(max), avg: compactNum(avg) };
  }, [widget.data, yField]);

  return (
    <WidgetCard widget={widget} {...actions}>
      {stats && (
        <div className="widget-metrics-strip">
          <span className="widget-metric-chip">Total <strong>{stats.total}</strong></span>
          <span className="widget-metric-chip">Peak <strong>{stats.max}</strong></span>
          <span className="widget-metric-chip">Avg <strong>{stats.avg}</strong></span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={widget.data} margin={{ top: 6, right: 8, left: -8, bottom: 2 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.38} />
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
              cursor={{ fill: 'rgba(255,255,255,0.04)', radius: 6 }}
            />
            <Bar
              dataKey={yField}
              radius={[6, 6, 2, 2]}
              maxBarSize={44}
              isAnimationActive={false}
              cursor={clickable ? 'pointer' : undefined}
              onClick={(data) => clickable && onRowClick?.(data as Record<string, any>)}
            >
              {widget.data.map((_, i) => (
                <Cell key={i} fill={`url(#${gradId})`} stroke={color} strokeOpacity={0.5} strokeWidth={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

