import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { widgetColor } from '../DashboardBuilder';

const GW_SIG_THRESHOLD = 7.301; // -log10(5e-8)
const SUGGESTIVE_THRESHOLD = 5.0; // -log10(1e-5)

function parseChrOrder(chr: string): number {
  const cleaned = chr.replace(/^chr/i, '').trim().toUpperCase();
  const num = Number(cleaned);
  if (Number.isFinite(num) && num > 0) return num;
  if (cleaned === 'X') return 23;
  if (cleaned === 'Y') return 24;
  if (cleaned === 'MT' || cleaned === 'M') return 25;
  return 99;
}

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
  actions?: WidgetActions;
}

export default function ManhattanWidget({ widget, onRowClick, actions }: Props) {
  const accent = widget.color ?? widgetColor(widget.id);
  const rows = Array.isArray(widget.data) ? widget.data : [];

  const {
    evenChrPoints,
    oddChrPoints,
    sigPoints,
    chrTicks,
    chrLabels,
    totalVariants,
    sigCount,
    topHit,
  } = useMemo(() => {
    const sample = rows[0] ?? {};
    const keys = Object.keys(sample);

    const chrKey =
      widget.group_by && keys.includes(widget.group_by)
        ? widget.group_by
        : widget.x_field && keys.includes(widget.x_field)
        ? widget.x_field
        : keys.find((k) => /^(chr|chrom|chromosome)$/i.test(k)) ?? keys[0] ?? 'chr';

    const posKey =
      widget.x_field && widget.x_field !== chrKey && keys.includes(widget.x_field)
        ? widget.x_field
        : keys.find((k) => /^(pos|position|bp|start)$/i.test(k));

    const rawY = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field;
    const pKey =
      rawY && keys.includes(rawY)
        ? rawY
        : keys.find((k) => /^(p_value|pval|p|padj|neg_log10_p|log10p)$/i.test(k)) ?? keys[1] ?? 'p';

    const labelKey = keys.find((k) => /^(snp|rsid|variant|gene|symbol|id|name)$/i.test(k));

    // Determine whether values are raw p-values (0 < p <= 1) or already -log10(p)
    const rawVals = rows.map((r) => Number(r[pKey])).filter((v) => Number.isFinite(v) && v > 0);
    const isRawP = rawVals.length > 0 && rawVals.every((v) => v <= 1.0) && rawVals.some((v) => v < 0.5);

    // Group by chromosome so we can assign cumulative genomic coordinates
    const byChr = new Map<string, { pos: number; negLogP: number; rawP: number; label: string; chr: string; raw: Record<string, any> }[]>();
    rows.forEach((r, idx) => {
      const val = Number(r[pKey]);
      if (!Number.isFinite(val) || val <= 0) return;
      const negLogP = isRawP ? -Math.log10(Math.max(val, 1e-300)) : val;
      const chr = String(r[chrKey] ?? '1').replace(/^chr/i, '');
      const pos = posKey && Number.isFinite(Number(r[posKey])) ? Number(r[posKey]) : idx + 1;
      const label = labelKey && r[labelKey] ? String(r[labelKey]) : `chr${chr}:${pos}`;
      if (!byChr.has(chr)) byChr.set(chr, []);
      byChr.get(chr)!.push({ pos, negLogP, rawP: val, label, chr, raw: r });
    });

    const sortedChrs = Array.from(byChr.keys()).sort((a, b) => parseChrOrder(a) - parseChrOrder(b));
    const evenPts: any[] = [];
    const oddPts: any[] = [];
    const sigPts: any[] = [];
    const ticks: number[] = [];
    const labelsMap = new Map<number, string>();

    let offset = 0;
    let best: { label: string; negLogP: number; chr: string } | null = null;

    sortedChrs.forEach((chr, chrIdx) => {
      const pts = byChr.get(chr)!.sort((a, b) => a.pos - b.pos);
      const minPos = pts[0]?.pos ?? 0;
      const maxPos = pts[pts.length - 1]?.pos ?? 1;
      const span = Math.max(maxPos - minPos, pts.length, 1);

      const centerTick = offset + span / 2;
      ticks.push(centerTick);
      labelsMap.set(centerTick, chr);

      pts.forEach((pt, i) => {
        const xCoord = offset + (maxPos > minPos ? pt.pos - minPos : i + 0.5);
        const item = { ...pt, x: xCoord };
        if (!best || pt.negLogP > best.negLogP) {
          best = { label: pt.label, negLogP: pt.negLogP, chr: pt.chr };
        }
        if (pt.negLogP >= GW_SIG_THRESHOLD) {
          sigPts.push(item);
        } else if (chrIdx % 2 === 0) {
          evenPts.push(item);
        } else {
          oddPts.push(item);
        }
      });

      offset += span * 1.12;
    });

    return {
      evenChrPoints: evenPts,
      oddChrPoints: oddPts,
      sigPoints: sigPts,
      chrTicks: ticks,
      chrLabels: labelsMap,
      totalVariants: evenPts.length + oddPts.length + sigPts.length,
      sigCount: sigPts.length,
      topHit: best as { label: string; negLogP: number; chr: string } | null,
    };
  }, [rows, widget.x_field, widget.y_field, widget.group_by]);

  const handleClick =
    widget.drill_down?.enabled && onRowClick
      ? (pt: any) => pt?.raw && onRowClick(pt.raw)
      : undefined;

  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="flex flex-col h-full w-full gap-1.5">
        <div className="widget-metrics-strip">
          <div className="widget-metric-chip">
            <span className="widget-metric-label">Loci</span>
            <span className="widget-metric-val">{totalVariants.toLocaleString()}</span>
          </div>
          <div className="widget-metric-chip">
            <span className="widget-metric-label">GWAS Hits (p&lt;5e-8)</span>
            <span className="widget-metric-val" style={{ color: sigCount > 0 ? '#10b981' : undefined }}>
              {sigCount.toLocaleString()}
            </span>
          </div>
          {topHit && (
            <div className="widget-metric-chip">
              <span className="widget-metric-label">Lead Variant</span>
              <span className="widget-metric-val">
                {topHit.label} ({topHit.negLogP.toFixed(1)})
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 12, left: -14, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
              <XAxis
                type="number"
                dataKey="x"
                domain={['dataMin', 'dataMax']}
                ticks={chrTicks}
                tickFormatter={(val) => chrLabels.get(val) ?? ''}
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="negLogP"
                name="-log10(p)"
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <ZAxis range={[28, 28]} />
              <ReferenceLine
                y={GW_SIG_THRESHOLD}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.2}
              />
              <ReferenceLine
                y={SUGGESTIVE_THRESHOLD}
                stroke="rgba(148,163,184,0.35)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: 'rgba(148,163,184,0.3)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0].payload;
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
                      <div className="font-semibold mb-1" style={{ color: '#38bdf8' }}>{pt.label}</div>
                      <div>Chr: <strong>{pt.chr}</strong> · Pos: <strong>{Number(pt.pos).toLocaleString()}</strong></div>
                      <div>-log10(p): <strong>{Number(pt.negLogP).toFixed(2)}</strong></div>
                    </div>
                  );
                }}
              />
              <Scatter data={evenChrPoints} fill={accent} fillOpacity={0.75} isAnimationActive={false} onClick={handleClick} />
              <Scatter data={oddChrPoints} fill="#64748b" fillOpacity={0.7} isAnimationActive={false} onClick={handleClick} />
              <Scatter data={sigPoints} fill="#10b981" fillOpacity={0.95} isAnimationActive={false} onClick={handleClick} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </WidgetCard>
  );
}

