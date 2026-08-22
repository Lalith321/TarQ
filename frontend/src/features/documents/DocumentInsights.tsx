import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DocumentUpload from './DocumentUpload';
import type { InsightBundle } from '@/services/types';

export default function DocumentInsights() {
  const [bundle, setBundle] = useState<InsightBundle | null>(null);

  return (
    <div className="space-y-6">
      <DocumentUpload onExtracted={setBundle} />

      {bundle && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">{bundle.source_file}</h3>
            {bundle.low_confidence && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                Low-confidence extraction — no LLM configured, heuristic fallback used
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{bundle.chunk_count} chunk(s) processed</span>
          </div>

          <Card className="p-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Summary</h4>
            <p className="text-sm">{bundle.summary || '—'}</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Entities</h4>
              {bundle.entities.length === 0 ? (
                <p className="text-xs text-muted-foreground">None found</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {bundle.entities.map((e) => (
                    <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Metrics</h4>
              {bundle.metrics.length === 0 ? (
                <p className="text-xs text-muted-foreground">None found</p>
              ) : (
                <ul className="space-y-1">
                  {bundle.metrics.map((m, i) => (
                    <li key={i} className="text-sm flex justify-between">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-semibold">{m.value}{m.unit ? ` ${m.unit}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Action Items</h4>
              {bundle.action_items.length === 0 ? (
                <p className="text-xs text-muted-foreground">None found</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {bundle.action_items.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Risks</h4>
              {bundle.risks.length === 0 ? (
                <p className="text-xs text-muted-foreground">None found</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-sm text-rose-600">
                  {bundle.risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
