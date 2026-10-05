import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchAnalystState } from '@/services/analystService';
import { WidgetRenderer } from '@/components/WidgetRenderer';
import type { AnalystState, WidgetSpec } from '@/services/types';
import { buildLineChartModel } from '@/lib/lineChartData';

interface Props {
  sessionId: string | null;
  refreshKey?: number;
}

/** Convert dashboard_tool's {data, x_field, y_field} shape → WidgetRenderer's {series, labels} shape */
function adaptWidget(w: Record<string, any>): WidgetSpec {
  const rows: Record<string, any>[] = w.data ?? [];
  const xField: string = w.x_field ?? 'x';
  const chart = buildLineChartModel(rows, xField, w.y_field, w.group_by);
  const series = chart.series.map(({ key, name }) => ({
    name,
    data: chart.data.map((row) => ({ x: row[xField], y: row[key] })),
  }));

  return {
    ...w,
    series,
    labels: chart.labels,
    position: w.position ?? { x: 0, y: 0, w: 4, h: 2 },
  } as unknown as WidgetSpec;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-slate-400',
  in_progress: 'text-amber-400',
  completed: 'text-emerald-400',
  blocked: 'text-red-400',
};

export default function AnalystStatePanel({ sessionId, refreshKey }: Props) {
  const [state, setState] = useState<AnalystState | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetchAnalystState(sessionId).then(setState).catch(() => setState(null));
  }, [sessionId, refreshKey]);

  if (!sessionId) return <p className="text-xs text-slate-500">No active session.</p>;
  if (!state) return <p className="text-xs text-slate-500">Loading state…</p>;

  const aiMessages = state.messages.filter((m) => m.role === 'ai' && m.content);
  const artifactKeys = Object.keys(state.artifacts ?? {});

  return (
    <div className="space-y-4">
      {/* Todo plan */}
      {state.todo.length > 0 && (
        <Card className="p-4 border-white/[0.06] bg-white/[0.02]">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Plan</h4>
          <div className="space-y-2">
            {state.todo.map((t) => (
              <div key={t.id} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 font-semibold shrink-0 ${STATUS_COLOR[t.status] ?? 'text-slate-400'}`}>
                  [{t.status}]
                </span>
                <span className="text-slate-300">{t.description}</span>
                <Badge variant="outline" className="ml-auto text-[9px] shrink-0">{t.assigned_to}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Next step */}
      {state.next_step?.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
          Next: {state.next_step.join(', ')}
        </div>
      )}

      {/* Widgets produced */}
      {state.widgets.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Widgets produced ({state.widgets.length})
          </h4>
          {state.widgets.map((w, i) => (
            <WidgetRenderer key={w.id ?? i} widget={adaptWidget(w)} />
          ))}
        </div>
      )}

      {/* Artifacts */}
      {artifactKeys.length > 0 && (
        <Card className="p-4 border-white/[0.06] bg-white/[0.02]">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Artifacts</h4>
          <div className="space-y-1">
            {artifactKeys.map((k) => (
              <div key={k} className="text-xs text-slate-400">
                <span className="font-semibold text-slate-300">{k}</span>: {state.artifacts[k]}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Last AI message */}
      {aiMessages.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500">Last coordinator note</summary>
          <pre className="mt-2 p-3 bg-slate-950/50 rounded-lg whitespace-pre-wrap text-slate-300 border border-white/[0.06]">
            {aiMessages[aiMessages.length - 1].content}
          </pre>
        </details>
      )}
    </div>
  );
}
