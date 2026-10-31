import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';
import { buildLineChartModel } from '@/lib/lineChartData';

const MULTI = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];

function compactNum(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

export default function LineWidget({ widget, actions }: { widget: WidgetSpec; actions?: WidgetActions }) {
  const chart = buildLineChartModel(widget.data, widget.x_field ?? 'x', widget.y_field, widget.group_by);
  const base = widget.color ?? widgetColor(widget.id);

  const summary = useMemo(() => {
    const firstSeries = chart.series[0]?.key;
    if (!firstSeries || !chart.data.length) return null;
    const nums = chart.data
      .map((r) => Number(r?.[firstSeries]))
      .filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    const first = nums[0];
    const last = nums[nums.length - 1];
    const peak = Math.max(...nums);
    const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
    return {
      latest: compactNum(last),
      peak: compactNum(peak),
      pct: pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : null,
      positive: pct === null || pct >= 0,
    };
  }, [chart.data, chart.series]);

  return (
    <WidgetCard widget={widget} {...actions}>
      {summary && (
        <div className="widget-metrics-strip">
          <span className="widget-metric-chip">Latest <strong>{summary.latest}</strong></span>
          <span className="widget-metric-chip">Peak <strong>{summary.peak}</strong></span>
          {summary.pct && (
            <span className="widget-metric-chip">
              Trend <strong style={{ color: summary.positive ? '#10b981' : '#f87171' }}>{summary.pct}</strong>
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart.data} margin={{ top: 6, right: 10, left: -6, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
            <XAxis
              dataKey={widget.x_field}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
            />
            <YAxis
              type="number"
              domain={['auto', 'auto']}
              width={48}
              tickFormatter={compactNum}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: any, name: any) => [compactNum(value), name]}
              contentStyle={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-muted)',
                borderRadius: 10,
                fontSize: 11,
                color: 'var(--text-primary)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
              }}
            />
            {chart.series.length > 1 && (
              <Legend verticalAlign="bottom" height={22} iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: 'var(--text-secondary)' }} />
            )}
            {chart.series.map(({ key, name }, index) => {
              const strokeColor = chart.series.length === 1 ? base : MULTI[index % MULTI.length];
              return (
                <Line
                  key={key}
                  name={name}
                  type="monotone"
                  dataKey={key}
                  stroke={strokeColor}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={chart.data.length <= 16 ? { r: 2.5, fill: strokeColor, strokeWidth: 0 } : false}
                  activeDot={{ r: 5, fill: strokeColor, stroke: 'var(--bg-surface)', strokeWidth: 2 }}
                  connectNulls={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

