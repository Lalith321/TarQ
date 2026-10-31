import React, { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';
import TiledVisualizer from '@/components/tiling/TiledVisualizer';
import { Layers } from 'lucide-react';

const SERIES_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#14b8a6',
];

function formatCompact(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (abs > 0 && abs < 0.01) return v.toExponential(1);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
  actions?: WidgetActions;
}

export default function ScatterWidget({ widget, onRowClick, actions }: Props) {
  const baseColor = widget.color ?? widgetColor(widget.id);
  const rows = Array.isArray(widget.data) ? widget.data : [];
  const [tiledMode, setTiledMode] = useState<boolean>(rows.length > 600);

  const { xField, yField, groupField, groups, totalPoints, correlation, spatialPoints } = useMemo(() => {
    const sample = rows[0] ?? {};
    const keys = Object.keys(sample);
    const numericKeys = keys.filter((k) => typeof sample[k] === 'number' || !Number.isNaN(Number(sample[k])));

    const resolvedX = widget.x_field && keys.includes(widget.x_field)
      ? widget.x_field
      : numericKeys[0] ?? keys[0] ?? 'x';

    const rawY = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field;
    const resolvedY = rawY && keys.includes(rawY)
      ? rawY
      : numericKeys.find((k) => k !== resolvedX) ?? keys[1] ?? 'y';

    const resolvedGroup = widget.group_by && keys.includes(widget.group_by) ? widget.group_by : undefined;

    const grouped = new Map<string, { x: number; y: number; label: string; raw: Record<string, any> }[]>();
    const xs: number[] = [];
    const ys: number[] = [];
    const sPoints: import('@/lib/spatialTiling').SpatialPoint[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const x = Number(row[resolvedX]);
      const y = Number(row[resolvedY]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xs.push(x);
      ys.push(y);
      const gKey = resolvedGroup ? String(row[resolvedGroup] ?? 'Unassigned') : 'All Points';
      const label = String(row.id ?? row.sample ?? row.gene ?? row.name ?? `Point #${i + 1}`);
      if (!grouped.has(gKey)) grouped.set(gKey, []);
      grouped.get(gKey)!.push({ x, y, label, raw: row });

      sPoints.push({
        id: row.id ?? i,
        x,
        y,
        label,
        category: gKey,
        metadata: row,
      });
    }

    // Compute Pearson r when >= 2 points
    let rVal: number | null = null;
    if (xs.length >= 2) {
      const n = xs.length;
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = ys.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let denX = 0;
      let denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      const denom = Math.sqrt(denX * denY);
      if (denom > 0) rVal = num / denom;
    }

    const groupList = Array.from(grouped.entries()).map(([name, pts], idx) => ({
      name,
      points: pts,
      color: idx === 0 && !resolvedGroup ? baseColor : SERIES_PALETTE[idx % SERIES_PALETTE.length],
    }));

    // Attach colors to spatial points
    const colorMap = new Map(groupList.map(g => [g.name, g.color]));
    for (const pt of sPoints) {
      if (pt.category && colorMap.has(pt.category)) {
        pt.color = colorMap.get(pt.category);
      } else {
        pt.color = baseColor;
      }
    }

    return {
      xField: resolvedX,
      yField: resolvedY,
      groupField: resolvedGroup,
      groups: groupList,
      totalPoints: xs.length,
      correlation: rVal,
      spatialPoints: sPoints,
    };
  }, [rows, widget.x_field, widget.y_field, widget.group_by, baseColor]);

  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="flex flex-col h-full w-full gap-1.5">
        <div className="widget-metrics-strip flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="widget-metric-chip">
              <span className="widget-metric-label">Samples</span>
              <span className="widget-metric-val">{totalPoints.toLocaleString()}</span>
            </div>
            {groupField && (
              <div className="widget-metric-chip">
                <span className="widget-metric-label">Clusters ({groupField})</span>
                <span className="widget-metric-val">{groups.length}</span>
              </div>
            )}
            {correlation !== null && (
              <div className="widget-metric-chip">
                <span className="widget-metric-label">Pearson r</span>
                <span className="widget-metric-val">{correlation.toFixed(3)}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTiledMode((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1.5 transition-all border ${
              tiledMode
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:border-white/20'
            }`}
            title={tiledMode ? 'Switch to standard SVG view' : 'Switch to High-Performance Tiled Canvas'}
          >
            <Layers className="w-3 h-3 text-cyan-400" />
            {tiledMode ? 'Tiled Canvas (Active)' : 'Tiled View'}
          </button>
        </div>

        {tiledMode ? (
          <div className="flex-1 min-h-0 w-full rounded-lg overflow-hidden border border-white/10">
            <TiledVisualizer
              points={spatialPoints}
              mode="clusters"
              title={`${widget.title} (Spatial Tiles)`}
              onPointClick={(pt) => {
                if (widget.drill_down?.enabled && onRowClick && pt.metadata) {
                  onRowClick(pt.metadata);
                }
              }}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xField}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  tickFormatter={formatCompact}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yField}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  tickFormatter={formatCompact}
                  axisLine={false}
                  tickLine={false}
                />
                <ZAxis range={[36, 36]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: 'rgba(148,163,184,0.35)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload as { x: number; y: number; label: string };
                    return (
                      <div
                        style={{
                          background: 'rgba(10, 15, 29, 0.94)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          fontSize: '11px',
                          color: '#f8fafc',
                          boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                        }}
                      >
                        <div className="font-semibold mb-1" style={{ color: '#94a3b8' }}>{pt.label}</div>
                        <div>{xField}: <strong>{formatCompact(pt.x)}</strong></div>
                        <div>{yField}: <strong>{formatCompact(pt.y)}</strong></div>
                      </div>
                    );
                  }}
                />
                {groups.map((g) => (
                  <Scatter
                    key={g.name}
                    name={g.name}
                    data={g.points}
                    fill={g.color}
                    fillOpacity={0.82}
                    isAnimationActive={false}
                    onClick={
                      widget.drill_down?.enabled && onRowClick
                        ? (pt: any) => pt?.raw && onRowClick(pt.raw)
                        : undefined
                    }
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

