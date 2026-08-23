import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchAnalystState } from '@/services/analystService';
import type { AnalystState } from '@/services/types';

interface Props {
  sessionId: string | null;
  /** Bump this to force a refetch after your chat UI sends a message —
   * state doesn't push, it's pulled on demand. */
  refreshKey?: number;
}

/**
 * Drop this next to an existing chat UI, passing the same sessionId used
 * for sendAnalystMessage() calls. This is the one part of the analyst
 * that's genuinely new surface area — a chat UI has no reason to already
 * know how to render sandbox dataframes, a todo plan, or an artifact vault.
 */
export default function AnalystStatePanel({ sessionId, refreshKey }: Props) {
  const [state, setState] = useState<AnalystState | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetchAnalystState(sessionId).then(setState).catch(() => setState(null));
  }, [sessionId, refreshKey]);

  if (!sessionId) {
    return <p className="text-xs text-muted-foreground">No active session.</p>;
  }
  if (!state) {
    return <p className="text-xs text-muted-foreground">Loading state…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{state.context_turns} live turns</span>
        <span>{state.context_memory_blocks} compressed memory blocks</span>
        <span>{state.artifacts.length} artifacts stored (kept out of conversation)</span>
      </div>

      {Object.keys(state.dataframes).length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Dataframes</h4>
          {Object.entries(state.dataframes).map(([name, d]) => (
            <div key={name} className="text-xs mb-1">
              <span className="font-semibold">{name}</span>: shape={JSON.stringify(d.shape)}, columns={d.columns.join(', ')}
            </div>
          ))}
        </Card>
      )}

      {state.todos.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Plan</h4>
          {state.todos.map((t, i) => (
            <div key={i} className="text-xs flex items-center gap-2">
              <Badge variant="outline" className="text-[9px]">{t.status}</Badge>
              {t.text}
            </div>
          ))}
        </Card>
      )}

      {state.files.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Files</h4>
          <p className="text-xs">{state.files.join(', ')}</p>
        </Card>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Raw state block (what's injected into the prompt)</summary>
        <pre className="mt-2 p-3 bg-muted/20 rounded-lg whitespace-pre-wrap">{state.rendered}</pre>
      </details>
    </div>
  );
}
