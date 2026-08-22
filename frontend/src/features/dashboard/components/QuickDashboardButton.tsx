import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { quickDashboard } from '@/services/dashboardService';

interface Props { builderRoute?: string; onCreated?: (dashboard: { id: string; title: string }) => void; }

export function QuickDashboardButton({ builderRoute = '/dashboard/builder', onCreated }: Props) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const dashboard = await quickDashboard(prompt.trim());
      setOpen(false); setPrompt('');
      onCreated?.(dashboard);
      navigate(`${builderRoute}?id=${dashboard.id}&quick=1`);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        Quick dashboard
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="text-lg font-semibold">Quick Dashboard</h3>
            <p className="mt-1 text-sm text-muted-foreground">Describe what you want and the agent will build it instantly.</p>
            <form onSubmit={handleSubmit} className="mt-4">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Show me Q3 revenue by region with a bar chart and a breakdown table" className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" rows={3} autoFocus/>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => { setOpen(false); setPrompt(''); setError(null); }}>Cancel</Button>
                <Button type="submit" disabled={loading || !prompt.trim()}>{loading ? 'Building…' : 'Build'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}