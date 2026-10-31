import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

const PALETTE = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#f97316'];

function compactNum(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

export default function PieWidget({ widget, actions }: { widget: WidgetSpec; actions?: WidgetActions }) {
  const yField = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field ?? 'value';
  const nameKey = widget.x_field ?? 'name';
  const base = widget.color ?? widgetColor(widget.id);
  const baseIdx = PALETTE.indexOf(base);
  const colors = PALETTE.slice(baseIdx >= 0 ? baseIdx : 0).concat(PALETTE.slice(0, baseIdx >= 0 ? baseIdx : 0));

  const { total, items } = useMemo(() => {
    const rows = widget.data ?? [];
    const sum = rows.reduce((acc, r) => acc + (Number(r?.[yField]) || 0), 0);
    const list = rows.slice(0, 6).map((r, i) => {
      const val = Number(r?.[yField]) || 0;
      const pct = sum > 0 ? (val / sum) * 100 : 0;
      return {
        label: String(r?.[nameKey] ?? `Item ${i + 1}`),
        val,
        pct,
        color: colors[i % colors.length],
      };
    });
    return { total: sum, items: list };
  }, [widget.data, yField, nameKey, colors]);

  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="flex h-full min-h-0 items-center gap-3">
        <div className="relative h-full flex-1 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={widget.data}
                dataKey={yField}
                nameKey={nameKey}
                innerRadius="54%"
                outerRadius="82%"
                paddingAngle={3}
                cornerRadius={4}
                stroke="var(--bg-surface)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {widget.data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any) => [
                  `${compactNum(value)} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : '0.0'}%)`,
                  name,
                ]}
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 10,
                  fontSize: 11,
                  color: 'var(--text-primary)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{compactNum(total)}</span>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex w-[44%] max-w-[165px] flex-col justify-center gap-1.5 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="truncate font-medium" style={{ color: 'var(--text-secondary)' }} title={item.label}>
                    {item.label}
                  </span>
                </div>
                <span className="flex-shrink-0 font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {item.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

