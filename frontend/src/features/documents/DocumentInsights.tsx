import React, { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { InsightBundle } from '@/services/types';

export default function DocumentInsights() {
  const [bundle, setBundle] = useState<InsightBundle | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE_URL}/documents/upload`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      setBundle(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] py-10 text-center transition-colors hover:border-blue-500/30 hover:bg-blue-500/5"
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        {uploading ? (
          <p className="text-sm text-slate-400">Extracting insights…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-white">Drop a document to extract insights</p>
            <p className="text-xs text-slate-500">PDF · DOCX · TXT · CSV · Markdown</p>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</p>
      )}

      {bundle && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{bundle.source_file}</h3>
            {bundle.low_confidence && (
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                Heuristic fallback — no LLM configured
              </Badge>
            )}
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{bundle.chunk_count} chunk(s)</span>
          </div>

          <Card className="p-4">
            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Summary</h4>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{bundle.summary || '—'}</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Entities</h4>
              {bundle.entities.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None found</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {bundle.entities.map((e) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Metrics</h4>
              {bundle.metrics.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None found</p>
              ) : (
                <ul className="space-y-1">
                  {bundle.metrics.map((m, i) => (
                    <li key={i} className="text-sm flex justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{m.value}{m.unit ? ` ${m.unit}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Action Items</h4>
              {bundle.action_items.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None found</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {bundle.action_items.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Risks</h4>
              {bundle.risks.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None found</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-sm text-red-400">
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
