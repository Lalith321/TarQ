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

const FC_THRESHOLD = 1.0;        // |log2FC| >= 1.0 (2x fold change)
const P_SIG_NEG_LOG10 = 1.30103; // -log10(0.05)

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
  actions?: WidgetActions;
}

export default function VolcanoWidget({ widget, onRowClick, actions }: Props) {
  const rows = Array.isArray(widget.data) ? widget.data : [];

  const { upPoints, downPoints, nsPoints, totalCount, topGene } = useMemo(() => {
    const sample = rows[0] ?? {};
    const keys = Object.keys(sample);

    const fcKey =
      widget.x_field && keys.includes(widget.x_field)
        ? widget.x_field
        : keys.find((k) => /^(log2fc|log2_fold_change|fold_change|fc|beta|effect)$/i.test(k)) ?? keys[0] ?? 'log2fc';

    const rawY = Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field;
    const pKey =
      rawY && keys.includes(rawY)
        ? rawY
        : keys.find((k) => /^(padj|fdr|qval|p_value|pval|p|neg_log10_p)$/i.test(k)) ?? keys[1] ?? 'padj';

    const geneKey =
      widget.group_by && keys.includes(widget.group_by)
        ? widget.group_by
        : keys.find((k) => /^(gene|symbol|gene_name|transcript|protein|id|name)$/i.test(k));

    const rawPVals = rows.map((r) => Number(r[pKey])).filter((v) => Number.isFinite(v) && v > 0);
    const isRawP = rawPVals.length > 0 && rawPVals.every((v) => v <= 1.0) && rawPVals.some((v) => v < 0.5);

    const up: any[] = [];
    const down: any[] = [];
    const ns: any[] = [];
    let best: { gene: string; fc: number; negLogP: number } | null = null;

    rows.forEach((r, idx) => {
      const fc = Number(r[fcKey]);
      const pVal = Number(r[pKey]);
      if (!Number.isFinite(fc) || !Number.isFinite(pVal) || pVal <= 0) return;

      const negLogP = isRawP ? -Math.log10(Math.max(pVal, 1e-300)) : pVal;
      const gene = geneKey && r[geneKey] ? String(r[geneKey]) : `Feature_${idx + 1}`;
      const pt = { x: fc, y: negLogP, gene, raw: r };

      if (!best || negLogP > best.negLogP) {
        best = { gene, fc, negLogP };
      }

      if (negLogP >= P_SIG_NEG_LOG10 && fc >= FC_THRESHOLD) {
        up.push(pt);
      } else if (negLogP >= P_SIG_NEG_LOG10 && fc <= -FC_THRESHOLD) {
        down.push(pt);
      } else {
        ns.push(pt);
      }
    });

    return {
      upPoints: up,
      downPoints: down,
      nsPoints: ns,
      totalCount: up.length + down.length + ns.length,
      topGene: best as { gene: string; fc: number; negLogP: number } | null,
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
            <span className="widget-metric-label">Features</span>
            <span className="widget-metric-val">{totalCount.toLocaleString()}</span>
          </div>
          <div className="widget-metric-chip">
            <span className="widget-metric-label">Up-Regulated</span>
            <span className="widget-metric-val" style={{ color: '#10b981' }}>
              ▲ {upPoints.length.toLocaleString()}
            </span>
          </div>
          <div className="widget-metric-chip">
            <span className="widget-metric-label">Down-Regulated</span>
            <span className="widget-metric-val" style={{ color: '#f43f5e' }}>
              ▼ {downPoints.length.toLocaleString()}
            </span>
          </div>
          {topGene && (
            <div className="widget-metric-chip">
              <span className="widget-metric-label">Top Hit</span>
              <span className="widget-metric-val">{topGene.gene}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 12, left: -14, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis
                type="number"
                dataKey="x"
                name="log2(FC)"
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                tickFormatter={(v: number) => (Number.isFinite(v) ? v.toFixed(1) : '0')}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="-log10(p)"
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                tickFormatter={(v: number) => (Number.isFinite(v) ? v.toFixed(1) : '0')}
                axisLine={false}
                tickLine={false}
              />
              <ZAxis range={[32, 32]} />
              <ReferenceLine y={P_SIG_NEG_LOG10} stroke="rgba(248,250,252,0.3)" strokeDasharray="4 4" />
              <ReferenceLine x={FC_THRESHOLD} stroke="rgba(16,185,129,0.4)" strokeDasharray="4 4" />
              <ReferenceLine x={-FC_THRESHOLD} stroke="rgba(244,63,94,0.4)" strokeDasharray="4 4" />
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
                      <div className="font-semibold mb-1" style={{ color: '#38bdf8' }}>{pt.gene}</div>
                      <div>log2(FC): <strong>{Number(pt.x).toFixed(2)}</strong></div>
                      <div>-log10(p): <strong>{Number(pt.y).toFixed(2)}</strong></div>
                    </div>
                  );
                }}
              />
              <Scatter name="Not Significant" data={nsPoints} fill="#64748b" fillOpacity={0.45} isAnimationActive={false} onClick={handleClick} />
              <Scatter name="Down-Regulated" data={downPoints} fill="#f43f5e" fillOpacity={0.88} isAnimationActive={false} onClick={handleClick} />
              <Scatter name="Up-Regulated" data={upPoints} fill="#10b981" fillOpacity={0.88} isAnimationActive={false} onClick={handleClick} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </WidgetCard>
  );
}

