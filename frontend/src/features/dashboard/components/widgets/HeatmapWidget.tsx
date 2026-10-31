import React, { useMemo, useState } from 'react';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
  actions?: WidgetActions;
}

function interpolateCellColor(norm: number, accentHex: string): string {
  // Clamp 0..1
  const t = Math.max(0, Math.min(1, norm));
  const clean = accentHex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 59;
  const g = parseInt(clean.slice(2, 4), 16) || 130;
  const b = parseInt(clean.slice(4, 6), 16) || 246;
  // Blend from deep slate (15, 23, 42) to accent color
  const rr = Math.round(15 + (r - 15) * t);
  const gg = Math.round(23 + (g - 23) * t);
  const bb = Math.round(42 + (b - 42) * t);
  const alpha = 0.22 + 0.72 * t;
  return `rgba(${rr}, ${gg}, ${bb}, ${alpha.toFixed(2)})`;
}

export default function HeatmapWidget({ widget, onRowClick, actions }: Props) {
  const accent = widget.color ?? widgetColor(widget.id);
  const rows = Array.isArray(widget.data) ? widget.data : [];
  const [hovered, setHovered] = useState<{ rLabel: string; cLabel: string; val: number } | null>(null);

  const { rowLabels, colLabels, matrix, minVal, maxVal } = useMemo(() => {
    if (!rows.length) {
      return { rowLabels: [], colLabels: [], matrix: new Map<string, { val: number; raw: Record<string, any> }>(), minVal: 0, maxVal: 1 };
    }

    const sample = rows[0];
    const keys = Object.keys(sample);
    const xKey = widget.x_field && keys.includes(widget.x_field) ? widget.x_field : keys[0] ?? 'x';
    const groupKey = widget.group_by && keys.includes(widget.group_by) ? widget.group_by : undefined;
    const ySpec = widget.y_field;

    const rSet = new Set<string>();
    const cSet = new Set<string>();
    const cellMap = new Map<string, { val: number; raw: Record<string, any> }>();
    let min = Infinity;
    let max = -Infinity;

    if (groupKey && typeof ySpec === 'string' && keys.includes(ySpec)) {
      // Long-form: x_field = column, group_by = row, y_field = numeric value
      for (const r of rows) {
        const cLabel = String(r[xKey] ?? '');
        const rLabel = String(r[groupKey] ?? '');
        const val = Number(r[ySpec]);
        if (!Number.isFinite(val)) continue;
        rSet.add(rLabel);
        cSet.add(cLabel);
        cellMap.set(`${rLabel}|||${cLabel}`, { val, raw: r });
        if (val < min) min = val;
        if (val > max) max = val;
      }
    } else {
      // Wide-form: xKey is row label, numeric columns (or y_field array) are columns
      const numericCols = Array.isArray(ySpec) && ySpec.length > 0
        ? ySpec.filter((k) => keys.includes(k))
        : keys.filter((k) => k !== xKey && (typeof sample[k] === 'number' || !Number.isNaN(Number(sample[k]))));

      for (const r of rows) {
        const rLabel = String(r[xKey] ?? '');
        rSet.add(rLabel);
        for (const col of numericCols) {
          const val = Number(r[col]);
          if (!Number.isFinite(val)) continue;
          cSet.add(col);
          cellMap.set(`${rLabel}|||${col}`, { val, raw: r });
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }

    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max) || max === min) max = min + 1;

    return {
      rowLabels: Array.from(rSet).slice(0, 40),
      colLabels: Array.from(cSet).slice(0, 40),
      matrix: cellMap,
      minVal: min,
      maxVal: max,
    };
  }, [rows, widget.x_field, widget.y_field, widget.group_by]);

  const span = maxVal - minVal || 1;
  const clickable = Boolean(widget.drill_down?.enabled && onRowClick);

  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="flex flex-col h-full w-full gap-1.5">
        <div className="widget-metrics-strip">
          <div className="widget-metric-chip">
            <span className="widget-metric-label">Dimensions</span>
            <span className="widget-metric-val">
              {rowLabels.length} × {colLabels.length}
            </span>
          </div>
          <div className="widget-metric-chip">
            <span className="widget-metric-label">Range</span>
            <span className="widget-metric-val">
              {minVal.toFixed(2)} – {maxVal.toFixed(2)}
            </span>
          </div>
          {hovered && (
            <div className="widget-metric-chip">
              <span className="widget-metric-label">
                {hovered.rLabel} · {hovered.cLabel}
              </span>
              <span className="widget-metric-val">{hovered.val.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 w-full overflow-auto rounded-lg">
          <div
            className="grid gap-[2px] text-[10px]"
            style={{
              gridTemplateColumns: `minmax(64px, auto) repeat(${Math.max(colLabels.length, 1)}, minmax(28px, 1fr))`,
            }}
          >
            {/* Header row */}
            <div className="sticky top-0 left-0 z-10 px-1.5 py-1 font-semibold text-slate-400" style={{ background: 'var(--bg-surface)' }} />
            {colLabels.map((c) => (
              <div
                key={c}
                className="sticky top-0 z-10 px-1 py-1 text-center font-semibold truncate"
                style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                title={c}
              >
                {c}
              </div>
            ))}

            {/* Matrix rows */}
            {rowLabels.map((r) => (
              <React.Fragment key={r}>
                <div
                  className="sticky left-0 z-10 px-1.5 py-1 font-medium truncate flex items-center"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                  title={r}
                >
                  {r}
                </div>
                {colLabels.map((c) => {
                  const cell = matrix.get(`${r}|||${c}`);
                  const val = cell?.val;
                  const norm = val !== undefined ? (val - minVal) / span : 0;
                  return (
                    <div
                      key={`${r}-${c}`}
                      onMouseEnter={() => val !== undefined && setHovered({ rLabel: r, cLabel: c, val })}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => clickable && cell?.raw && onRowClick?.(cell.raw)}
                      className={`rounded-[4px] min-h-[22px] flex items-center justify-center font-mono text-[9px] transition-transform hover:scale-[1.04] ${
                        clickable ? 'cursor-pointer' : ''
                      }`}
                      style={{
                        background: val !== undefined ? interpolateCellColor(norm, accent) : 'rgba(255,255,255,0.03)',
                        color: norm > 0.55 ? '#f8fafc' : 'var(--text-secondary)',
                      }}
                      title={val !== undefined ? `${r} × ${c}: ${val}` : `${r} × ${c}: —`}
                    >
                      {val !== undefined && colLabels.length <= 10 ? (Number.isInteger(val) ? val : val.toFixed(1)) : ''}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}

