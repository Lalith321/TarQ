import React from 'react';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

function formatStatValue(val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    return Number.isInteger(val) ? val.toLocaleString() : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const num = Number(val);
  if (Number.isFinite(num) && String(val).trim() !== '') {
    if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    return Number.isInteger(num) ? num.toLocaleString() : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(val);
}

export default function StatWidget({ widget, actions }: { widget: WidgetSpec; actions?: WidgetActions }) {
  const row = widget.data[0] ?? {};
  const keys = Object.keys(row);
  const yField = (Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field) ?? keys[0] ?? 'value';
  const value = row[yField] ?? (keys.length ? row[keys[0]] : undefined);
  const color = widget.color ?? widgetColor(widget.id);

  // Detect optional delta/change or secondary context field
  const deltaKey = keys.find((k) => k !== yField && /delta|change|pct|growth|trend/i.test(k));
  const secondaryKey = keys.find((k) => k !== yField && k !== deltaKey);
  const rawDelta = deltaKey ? String(row[deltaKey] ?? '') : '';
  const isNegative = rawDelta.trim().startsWith('-');

  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-xl p-3"
        style={{
          background: `radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, ${color} 16%, transparent) 0%, transparent 70%)`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            {String(yField).replace(/_/g, ' ')}
          </span>
          {rawDelta && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{
                background: isNegative ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)',
                color: isNegative ? '#f87171' : '#34d399',
                border: `1px solid ${isNegative ? 'rgba(239,68,68,0.28)' : 'rgba(16,185,129,0.28)'}`,
              }}
            >
              {isNegative ? '▼' : '▲'} {rawDelta}
            </span>
          )}
        </div>

        <div className="my-auto py-1">
          <p
            className="truncate text-4xl font-black tracking-tight tabular-nums"
            style={{ color: 'var(--text-primary)', textShadow: `0 0 28px color-mix(in srgb, ${color} 32%, transparent)` }}
            title={value !== undefined ? String(value) : undefined}
          >
            {formatStatValue(value)}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <span className="truncate text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            {secondaryKey ? `${secondaryKey.replace(/_/g, ' ')}: ${row[secondaryKey]}` : widget.title}
          </span>
          <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        </div>
      </div>
    </WidgetCard>
  );
}

