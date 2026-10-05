import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/apiEndpoints';
import {
  fetchDataSources as fetchPersistedDataSources,
  importSQLSchema as importPersistedSQLSchema,
  normalizeDataSource,
} from '@/services/dataSourceService';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type SourceType = 'structured' | 'document' | 'live';
type SourceStatus = 'connected' | 'ready' | 'streaming' | 'indexed' | 'failed' | 'processing';

interface DataSource {
  id: string;
  type: SourceType;
  name: string;
  subtype: string;
  status: SourceStatus;
  meta: string;
  detail: string;
  size?: string;
}

/* ═══════════════════════════════════════════════════════════════
   API STUBS — Wire these to your real backend
   ═══════════════════════════════════════════════════════════════ */

const fetchDataSources = async (): Promise<DataSource[]> => {
  const rows = await fetchPersistedDataSources();
  return rows.map((row) => normalizeDataSource(row));
};

const testSQLConnection = async (payload: any): Promise<{ success: boolean; schemas: string[]; tables: string[] }> => {
  const res = await fetch(`${API_BASE_URL}/schemas/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.error || 'Connection failed');
  }
  return body;
};

const importSQLSchema = async (_payload: any): Promise<DataSource> => {
  const row = await importPersistedSQLSchema(_payload);
  return normalizeDataSource(row);
};

const uploadExcelFile = async (_file: File): Promise<{ sheets: string[]; preview: any[][]; columns: { name: string; type: string }[] }> => {
  await new Promise((r) => setTimeout(r, 1000));
  return {
    sheets: ['Sales', 'Customers', 'Products'],
    preview: [
      ['Date', 'Product', 'Region', 'Revenue'],
      ['2025-01-01', 'Widget A', 'North', '$12,400'],
      ['2025-01-02', 'Widget B', 'South', '$8,200'],
      ['2025-01-03', 'Widget C', 'East', '$15,100'],
    ],
    columns: [
      { name: 'Date', type: 'datetime' },
      { name: 'Product', type: 'text' },
      { name: 'Region', type: 'text' },
      { name: 'Revenue', type: 'decimal' },
    ],
  };
};

const importExcelDataset = async (_payload: any): Promise<DataSource> => {
  await new Promise((r) => setTimeout(r, 600));
  return {
    id: `excel_${Date.now()}`,
    type: 'structured',
    name: _payload.fileName || 'sales.xlsx',
    subtype: 'Excel',
    status: 'ready',
    meta: `${_payload.sheets?.length || 1} sheets · ${_payload.columns?.length || 4} columns`,
    detail: 'Imported just now',
  };
};

const testWebSocket = async (_payload: any): Promise<{ success: boolean; schema: { column: string; type: string }[] }> => {
  await new Promise((r) => setTimeout(r, 800));
  return {
    success: true,
    schema: [
      { column: 'timestamp', type: 'datetime' },
      { column: 'sensor_id', type: 'string' },
      { column: 'temperature', type: 'number' },
      { column: 'status', type: 'string' },
    ],
  };
};

const saveWebSocketConnection = async (_payload: any): Promise<DataSource> => {
  await new Promise((r) => setTimeout(r, 400));
  return {
    id: `ws_${Date.now()}`,
    type: 'live',
    name: 'New Stream',
    subtype: 'WebSocket',
    status: 'streaming',
    meta: '0 records/min',
    detail: 'Connected',
  };
};

const uploadDocuments = async (_files: FileList): Promise<{ id: string; name: string; pages: number; size: string }[]> => {
  await new Promise((r) => setTimeout(r, 1200));
  return Array.from(_files).map((f, i) => ({
    id: `doc_${Date.now()}_${i}`,
    name: f.name,
    pages: Math.floor(Math.random() * 300) + 10,
    size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
  }));
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════ */

const Icons = {
  database: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
  ),
  excel: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
  ),
  live: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  ),
  document: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  ),
  more: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  ),
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
  ),
  upload: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
  ),
  spinner: (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   STATUS BADGE
   ═══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: SourceStatus }) {
  const config = {
    connected: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', label: 'Connected' },
    ready: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', label: 'Ready' },
    streaming: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', label: 'Streaming' },
    indexed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', label: 'Indexed' },
    processing: { color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', label: 'Processing' },
    failed: { color: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/20', label: 'Failed' },
  }[status];

  const isLive = status === 'connected' || status === 'streaming' || status === 'processing';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${config.bg} ${config.color} ring-1 ${config.ring}`}>
      <span className="relative flex h-1.5 w-1.5">
        {isLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: 'currentColor' }} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${status === 'failed' ? 'bg-red-400' : status === 'processing' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      </span>
      {config.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOURCE MENU
   ═══════════════════════════════════════════════════════════════ */

function SourceMenu({ type, onAction }: { type: SourceType; onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items =
    type === 'structured'
      ? ['View schema', 'Preview data', 'Refresh schema', 'Edit connection', 'Remove']
      : ['View details', 'Re-index', 'Download', 'Remove'];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
      >
        {Icons.more}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => { onAction(item); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-white/5 ${
                item === 'Remove' ? 'text-red-400 hover:text-red-300' : 'text-slate-300'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOURCE CARD
   ═══════════════════════════════════════════════════════════════ */

function SourceCard({ source, onAction }: { source: DataSource; onAction: (id: string, action: string) => void }) {
  const iconMap: Record<string, React.ReactNode> = {
    PostgreSQL: Icons.database,
    MySQL: Icons.database,
    'SQL Server': Icons.database,
    Excel: Icons.excel,
    CSV: Icons.excel,
    WebSocket: Icons.live,
    PDF: Icons.document,
    Word: Icons.document,
    Text: Icons.document,
  };

  return (
    <div className="group relative flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm transition-all hover:border-white/[0.10] hover:bg-white/[0.04]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400 ring-1 ring-white/5 transition-colors group-hover:text-slate-300">
        {iconMap[source.subtype] || Icons.document}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-white">{source.name}</h4>
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-white/5">{source.subtype}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {source.meta}
          {source.size && <span className="text-slate-600"> · {source.size}</span>}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <StatusBadge status={source.status} />
          <p className="mt-0.5 text-[10px] text-slate-600">{source.detail}</p>
        </div>
        <SourceMenu type={source.type} onAction={(a) => onAction(source.id, a)} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD DATA MODAL
   ═══════════════════════════════════════════════════════════════ */

function AddDataModal({ onClose, onSelect }: { onClose: () => void; onSelect: (type: string) => void }) {
  const options = [
    { id: 'sql', icon: Icons.database, title: 'SQL Database', desc: 'PostgreSQL, MySQL, SQL Server', color: 'hover:border-blue-500/30 hover:bg-blue-500/5' },
    { id: 'excel', icon: Icons.excel, title: 'Excel / CSV', desc: 'Import a spreadsheet file', color: 'hover:border-emerald-500/30 hover:bg-emerald-500/5' },
    { id: 'document', icon: Icons.document, title: 'Documents', desc: 'PDF, DOCX, TXT, Markdown', color: 'hover:border-purple-500/30 hover:bg-purple-500/5' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Create schema</h3>
            <p className="text-xs text-slate-500">Choose the source you want to connect.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{Icons.close}</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={`flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center transition-all ${opt.color} hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div className="text-slate-300">{opt.icon}</div>
              <div>
                <p className="text-sm font-semibold text-white">{opt.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SQL CONNECT DRAWER
   ═══════════════════════════════════════════════════════════════ */

function SQLConnectDrawer({ onClose, onAdd }: { onClose: () => void; onAdd: (s: DataSource) => void }) {
  const [step, setStep] = useState<'form' | 'tables'>('form');
  const [testing, setTesting] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [liveTracking, setLiveTracking] = useState(false);
  const [trackColumn, setTrackColumn] = useState('');
  const [form, setForm] = useState({ dbType: 'PostgreSQL', host: '', port: '5432', database: '', username: '', password: '', ssl: false });
  const { toast } = useToast();

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testSQLConnection(form);
      if (res.success) {
        setTables(res.tables);
        setSelectedTables(res.tables);
        setTrackColumn(res.tables[0] || '');
        setStep('tables');
        toast({ title: 'Connection successful' });
      }
    } catch (e: any) {
      toast({ title: 'Connection failed', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    try {
      const source = await importSQLSchema({ ...form, tables: selectedTables, liveTracking, trackColumn });
      onAdd(source);
      onClose();
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[420px] border-l border-white/[0.06] bg-slate-900/95 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-5">
        <h3 className="text-sm font-semibold text-white">Connect database</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{Icons.close}</button>
      </div>

      <div className="space-y-5 overflow-y-auto p-5">
        {step === 'form' ? (
          <>
            {[
              { key: 'dbType', label: 'Database type', type: 'select', options: ['PostgreSQL', 'MySQL', 'SQL Server'] },
              { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
              { key: 'port', label: 'Port', type: 'text', placeholder: '5432' },
              { key: 'database', label: 'Database', type: 'text', placeholder: 'my_db' },
              { key: 'username', label: 'Username', type: 'text', placeholder: 'user' },
              { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
            ].map((field) => (
              <div key={field.key}>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 text-xs text-white outline-none focus:border-primary/30"
                  >
                    {field.options?.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input
                    type={field.type}
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="h-9 border-white/10 bg-slate-800/50 text-xs text-white placeholder:text-slate-600 focus-visible:ring-primary/30"
                  />
                )}
              </div>
            ))}
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={form.ssl}
                onChange={(e) => setForm((f) => ({ ...f, ssl: e.target.checked }))}
                className="h-4 w-4 rounded border-white/10 bg-slate-800 text-primary"
              />
              SSL connection
            </label>
            <Button onClick={handleTest} disabled={testing} className="w-full gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              {testing ? <>{Icons.spinner} Testing...</> : 'Test connection'}
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                {Icons.check}
                <span className="text-sm font-semibold">Connection successful</span>
              </div>
              <p className="mt-1 text-xs text-emerald-400/70">Database: {form.database}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Tables</p>
              <div className="space-y-2">
                {tables.map((t) => (
                  <label key={t} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-white/10">
                    <input
                      type="checkbox"
                      checked={selectedTables.includes(t)}
                      onChange={(e) =>
                        setSelectedTables((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
                      }
                      className="h-4 w-4 rounded border-white/10 bg-slate-800 text-primary"
                    />
                    <span className="text-xs text-slate-300">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Enable live tracking</p>
                  <p className="text-[10px] text-slate-500">Watch one column for updates in real time</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveTracking((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${liveTracking ? 'bg-primary' : 'bg-slate-700'}`}
                  aria-label="Toggle live tracking"
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${liveTracking ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {liveTracking && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-slate-500">Tracking column</label>
                    <select
                      value={trackColumn}
                      onChange={(e) => setTrackColumn(e.target.value)}
                      className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 text-xs text-white outline-none focus:border-primary/30"
                    >
                      <option value="">Select a column</option>
                      {selectedTables.flatMap((table) => [table, `${table}_updated_at`, `${table}_timestamp`]).map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-300">
                    Live tracking will monitor the selected column and keep this schema updated as new rows arrive.
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('form')} className="flex-1 border-white/10 bg-transparent text-slate-300 hover:bg-white/5">
                Back
              </Button>
              <Button onClick={handleImport} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                Import schema
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXCEL IMPORT DRAWER
   ═══════════════════════════════════════════════════════════════ */

function ExcelImportDrawer({ onClose, onAdd }: { onClose: () => void; onAdd: (s: DataSource) => void }) {
  const [step, setStep] = useState<'drop' | 'preview'>('drop');
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[][]>([]);
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setUploading(true);
    setFileName(file.name);
    try {
      const res = await uploadExcelFile(file);
      setSheets(res.sheets);
      setSelectedSheets([res.sheets[0]]);
      setPreview(res.preview);
      setColumns(res.columns);
      setStep('preview');
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    try {
      const source = await importExcelDataset({ fileName, sheets: selectedSheets, columns });
      onAdd(source);
      onClose();
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[480px] border-l border-white/[0.06] bg-slate-900/95 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-5">
        <h3 className="text-sm font-semibold text-white">Import data</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{Icons.close}</button>
      </div>

      <div className="space-y-5 overflow-y-auto p-5">
        {step === 'drop' ? (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] py-12 text-center transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.parquet" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div className="text-slate-500">{Icons.upload}</div>
            <p className="text-sm font-medium text-white">Drop your file here</p>
            <p className="text-xs text-slate-500">Excel (.xlsx) · CSV · Parquet</p>
            <Button variant="outline" size="sm" className="mt-2 border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/5">
              Choose file
            </Button>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm font-semibold text-white">{fileName}</p>
              <p className="text-xs text-slate-500">Sheets</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sheets.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSheets((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedSheets.includes(s)
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</p>
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03]">
                    <tr>
                      {preview[0]?.map((h: string, i: number) => <th key={i} className="px-3 py-2 text-left font-medium text-slate-300">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(1).map((row, i) => (
                      <tr key={i} className="border-t border-white/[0.04]">
                        {row.map((cell: string, j: number) => <td key={j} className="px-3 py-2 text-slate-400">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Detected columns</p>
              <div className="space-y-1.5">
                {columns.map((c) => (
                  <div key={c.name} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                    <span className="text-xs text-slate-300">{c.name}</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">{c.type}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('drop')} className="flex-1 border-white/10 bg-transparent text-slate-300 hover:bg-white/5">
                Back
              </Button>
              <Button onClick={handleImport} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                Import dataset
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIVE DATA DRAWER
   ═══════════════════════════════════════════════════════════════ */

function LiveDataDrawer({ onClose, onAdd }: { onClose: () => void; onAdd: (s: DataSource) => void }) {
  const [form, setForm] = useState({ type: 'WebSocket', endpoint: '', auth: 'None', format: 'JSON' });
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [schema, setSchema] = useState<{ column: string; type: string }[]>([]);
  const { toast } = useToast();

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testWebSocket(form);
      if (res.success) {
        setConnected(true);
        setSchema(res.schema);
        toast({ title: 'Connected' });
      }
    } catch (e: any) {
      toast({ title: 'Connection failed', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      const source = await saveWebSocketConnection(form);
      onAdd(source);
      onClose();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[420px] border-l border-white/[0.06] bg-slate-900/95 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-5">
        <h3 className="text-sm font-semibold text-white">Connect live data</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{Icons.close}</button>
      </div>

      <div className="space-y-5 overflow-y-auto p-5">
        {!connected ? (
          <>
            {[
              { key: 'type', label: 'Connection type', options: ['WebSocket', 'SSE', 'MQTT'] },
              { key: 'endpoint', label: 'Endpoint', placeholder: 'wss://example.com/stream' },
              { key: 'auth', label: 'Authentication', options: ['None', 'Bearer Token', 'API Key'] },
              { key: 'format', label: 'Message format', options: ['JSON', 'CSV', 'Protobuf'] },
            ].map((field) => (
              <div key={field.key}>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">{field.label}</label>
                {'options' in field ? (
                  <select
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 text-xs text-white outline-none focus:border-primary/30"
                  >
                    {field.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="h-9 border-white/10 bg-slate-800/50 text-xs text-white placeholder:text-slate-600 focus-visible:ring-primary/30"
                  />
                )}
              </div>
            ))}
            <Button onClick={handleTest} disabled={testing} className="w-full gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              {testing ? <>{Icons.spinner} Connecting...</> : 'Test connection'}
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                {Icons.check}
                <span className="text-sm font-semibold">Connected</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-white/[0.03] p-2">
                  <p className="text-slate-500">Messages</p>
                  <p className="mt-0.5 font-semibold text-white">1,248 / min</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-2">
                  <p className="text-slate-500">Last message</p>
                  <p className="mt-0.5 font-semibold text-white">2 seconds ago</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Schema</p>
              <div className="space-y-1.5">
                {schema.map((s) => (
                  <div key={s.column} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                    <span className="text-xs text-slate-300">{s.column}</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">{s.type}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConnected(false)} className="flex-1 border-white/10 bg-transparent text-slate-300 hover:bg-white/5">
                Back
              </Button>
              <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                Save connection
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DOCUMENT UPLOAD DRAWER
   ═══════════════════════════════════════════════════════════════ */

function DocumentUploadDrawer({ onClose, onAdd }: { onClose: () => void; onAdd: (s: DataSource) => void }) {
  const [step, setStep] = useState<'drop' | 'processing' | 'done'>('drop');
  const [progress, setProgress] = useState(0);
  const [doc, setDoc] = useState<{ name: string; pages: number; size: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (files: FileList) => {
    setStep('processing');
    const docs = await uploadDocuments(files);
    setDoc(docs[0]);

    for (let i = 0; i <= 100; i += 20) {
      setProgress(i);
      await new Promise((r) => setTimeout(r, 400));
    }

    setStep('done');
  };

  const handleFinish = () => {
    if (!doc) return;
    onAdd({
      id: `doc_${Date.now()}`,
      type: 'document',
      name: doc.name,
      subtype: 'PDF',
      status: 'indexed',
      meta: `${doc.pages} pages`,
      detail: 'Indexed',
      size: doc.size,
    });
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[420px] border-l border-white/[0.06] bg-slate-900/95 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-5">
        <h3 className="text-sm font-semibold text-white">Add documents</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{Icons.close}</button>
      </div>

      <div className="space-y-5 overflow-y-auto p-5">
        {step === 'drop' && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); e.dataTransfer.files.length && handleFile(e.dataTransfer.files); }}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] py-12 text-center transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" multiple className="hidden" onChange={(e) => e.target.files?.length && handleFile(e.target.files)} />
            <div className="text-slate-500">{Icons.upload}</div>
            <p className="text-sm font-medium text-white">Drop files here</p>
            <div className="flex gap-2 text-[10px] text-slate-500">
              <span className="rounded bg-white/5 px-2 py-0.5">PDF</span>
              <span className="rounded bg-white/5 px-2 py-0.5">Word</span>
              <span className="rounded bg-white/5 px-2 py-0.5">Text</span>
              <span className="rounded bg-white/5 px-2 py-0.5">Markdown</span>
            </div>
          </div>
        )}

        {step === 'processing' && doc && (
          <div className="space-y-6 py-8 text-center">
            <div className="relative mx-auto h-24 w-24">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-white/5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                <path className="text-primary transition-all duration-300" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{progress}%</div>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">{doc.name}</p>
              <div className="mt-3 space-y-2 text-left">
                {['Uploaded', 'Text extracted', 'Document analyzed', 'Creating index'].map((label, i) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full ${i * 25 < progress ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-600'}`}>
                      {i * 25 < progress ? Icons.check : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                    <span className={i * 25 < progress ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'done' && doc && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                {Icons.check}
              </div>
              <p className="text-sm font-semibold text-white">{doc.name}</p>
              <p className="text-xs text-slate-500">{doc.pages} pages · {doc.size}</p>
              <p className="mt-1 text-[10px] font-medium text-emerald-400">✓ Indexed</p>
            </div>
            <Button onClick={handleFinish} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function DataSourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawer, setDrawer] = useState<'sql' | 'excel' | 'live' | 'document' | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'structured' | 'live' | 'documents'>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchDataSources()
      .then((s) => { setSources(s); setLoading(false); })
      .catch((e) => {
        toast({ title: 'Failed to load schemas', description: String(e), variant: 'destructive' });
        setLoading(false);
      });
  }, [toast]);

  const filtered = sources.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || s.type === filter;
    return matchesSearch && matchesFilter;
  });

  const grouped = {
    structured: filtered.filter((s) => s.type === 'structured'),
    live: filtered.filter((s) => s.type === 'live'),
    document: filtered.filter((s) => s.type === 'document'),
  };

  const handleAdd = (source: DataSource) => {
    setSources((prev) => [normalizeDataSource(source), ...prev]);
  };

  const handleMenuAction = (id: string, action: string) => {
    if (action === 'Remove') {
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast({ title: 'Source removed' });
    } else {
      toast({ title: action, description: 'Not implemented in this demo' });
    }
  };

  /* ── Section always renders so empty locations stay visible ── */
  const Section = ({ title, items }: { title: string; items: DataSource[] }) => (
    <div className="mb-8">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h3>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.015] p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-600">
            {title === 'Structured data' ? Icons.database : title === 'Live data' ? Icons.live : Icons.document}
          </div>
          <p className="text-xs text-slate-600">No {title.toLowerCase()} sources connected</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <SourceCard key={s.id} source={s} onAction={handleMenuAction} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-200">
      {/* Grid field */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.15]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="pointer-events-none fixed -left-32 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
      <div className="pointer-events-none fixed -right-32 bottom-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Schemas</h1>
            <p className="mt-2 text-sm text-slate-400">Connect and manage the schema sources available to your dashboards and agents.</p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="gap-2 rounded-full bg-white px-5 text-sm font-medium text-slate-950 shadow-lg shadow-white/10 transition-all hover:shadow-xl hover:shadow-white/15 hover:scale-[1.02] active:scale-[0.98]"
          >
            {Icons.plus}
            Add schema
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{Icons.search}</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schemas..."
              className="h-9 border-white/10 bg-slate-900/50 pl-9 text-sm text-white placeholder:text-slate-600 focus-visible:ring-primary/30"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'structured', 'live', 'documents'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                  filter === f ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.02]" />
            ))}
          </div>
        ) : (
          <>
            <Section title="Structured" items={grouped.structured} />
            <Section title="Live" items={grouped.live} />
            <Section title="Documents" items={grouped.document} />
          </>
        )}
      </div>

      {/* Modals & Drawers */}
      {modalOpen && <AddDataModal onClose={() => setModalOpen(false)} onSelect={(t) => { setModalOpen(false); setDrawer(t as any); }} />}
      {drawer === 'sql' && <SQLConnectDrawer onClose={() => setDrawer(null)} onAdd={handleAdd} />}
      {drawer === 'excel' && <ExcelImportDrawer onClose={() => setDrawer(null)} onAdd={handleAdd} />}
      {drawer === 'live' && <LiveDataDrawer onClose={() => setDrawer(null)} onAdd={handleAdd} />}
      {drawer === 'document' && <DocumentUploadDrawer onClose={() => setDrawer(null)} onAdd={handleAdd} />}
    </div>
  );
}