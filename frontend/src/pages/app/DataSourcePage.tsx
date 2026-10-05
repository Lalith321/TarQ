import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Database, FileSpreadsheet, FileText, LoaderCircle, MoreVertical, Plus, Radio, Search, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  deleteDataSource,
  fetchDataSources,
  importExcelDataset,
  importSQLSchema,
  normalizeDataSource,
  saveWebSocketConnection,
  testSQLConnection,
  testWebSocket,
  uploadDocument,
  uploadExcelFile,
} from '@/services/dataSourceService';
import type { DataSource } from '@/services/dataSourceService';

const Icons = {
  database: <Database size={20} strokeWidth={1.6} />,
  excel: <FileSpreadsheet size={20} strokeWidth={1.6} />,
  live: <Radio size={20} strokeWidth={1.6} />,
  document: <FileText size={20} strokeWidth={1.6} />,
  plus: <Plus size={16} strokeWidth={2} />,
  search: <Search size={16} strokeWidth={2} />,
  more: <MoreVertical size={16} strokeWidth={2} />,
  close: <X size={16} strokeWidth={2} />,
  check: <Check size={14} strokeWidth={2.5} />,
  upload: <Upload size={28} strokeWidth={1.6} />,
  spinner: <LoaderCircle size={16} className="animate-spin" />,
};

function StatusBadge({ status }: { status: DataSource['status'] }) {
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

function SourceMenu({ onAction }: { onAction: (action: string) => void }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const items = ['Delete'];

  const handleClick = () => {
    if (pos) { setPos(null); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = items.length * 36;
    setPos({
      top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8)),
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        aria-label="Source actions"
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
      >{Icons.more}</button>
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setPos(null)} />
          <div
            className="fixed z-[9999] w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
            style={{ top: pos.top, right: pos.right }}
          >
            {items.map((item) => (
              <button
                key={item}
                type="button"
                role="menuitem"
                onClick={() => { onAction(item); setPos(null); }}
                className={`block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-white/5 ${item === 'Delete' ? 'text-red-400 hover:text-red-300' : 'text-slate-300'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOURCE CARD
   ═══════════════════════════════════════════════════════════════ */

function SourceCard({ source, onAction }: { source: DataSource; onAction: (id: string, action: string) => void }) {
  const iconMap: Record<string, React.ReactNode> = {
    PostgreSQL: Icons.database, MySQL: Icons.database, 'SQL Server': Icons.database,
    Excel: Icons.excel, CSV: Icons.excel, WebSocket: Icons.live,
    PDF: Icons.document, Word: Icons.document, Text: Icons.document,
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
        <SourceMenu onAction={(a) => onAction(source.id, a)} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD DATA MODAL
   ═══════════════════════════════════════════════════════════════ */

function AddDataModal({ onClose, onSelect }: { onClose: () => void; onSelect: (type: string) => void }) {
  const options = [
    { id: 'sql', icon: Icons.database, title: 'PostgreSQL', desc: 'Connect a database for agent analysis', color: 'hover:border-blue-500/30 hover:bg-blue-500/5' },
    { id: 'document', icon: Icons.document, title: 'Document', desc: 'Extract and save document insights', color: 'hover:border-cyan-500/30 hover:bg-cyan-500/5' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div><h3 className="text-lg font-semibold text-white">Add schema</h3><p className="text-xs text-slate-500">Which schema source would you like to connect?</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{Icons.close}</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((opt) => (
            <button key={opt.id} onClick={() => onSelect(opt.id)} className={`flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center transition-all ${opt.color} hover:scale-[1.02] active:scale-[0.98]`}>
              <div className="text-slate-300">{opt.icon}</div>
              <div><p className="text-sm font-semibold text-white">{opt.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{opt.desc}</p></div>
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
  const [form, setForm] = useState({ dbType: 'PostgreSQL', host: '', port: '5432', database: '', username: '', password: '', ssl: false });
  const { toast } = useToast();

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testSQLConnection(form);
      setTables(res.tables);
      setSelectedTables(res.tables);
      setStep('tables');
      toast({ title: 'Connection successful' });
    } catch (e: any) {
      toast({ title: 'Connection failed', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    try {
      const source = await importSQLSchema({ ...form, tables: selectedTables });
      onAdd(source);
      onClose();
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-white/[0.08] bg-[#0b101b] shadow-2xl shadow-black/40 animate-in slide-in-from-right duration-300">
      <header className="flex shrink-0 items-start justify-between border-b border-white/[0.08] px-5 py-5 sm:px-7">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400">Data source</p>
          <h3 className="mt-1 text-base font-semibold text-white">Connect PostgreSQL</h3>
          <p className="mt-1 text-xs text-slate-400">Enter a read-only connection to discover available tables.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close database connection" className="ml-3 rounded-md p-2 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white">{Icons.close}</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        {step === 'form' ? (
          <div className="space-y-7">
            <section aria-labelledby="connection-details-heading">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 id="connection-details-heading" className="text-sm font-semibold text-slate-100">Connection details</h4>
                  <p className="mt-1 text-xs text-slate-500">Credentials are used to test and save this source.</p>
                </div>
                <span className="rounded border border-white/[0.08] px-2 py-1 text-[10px] font-medium text-slate-400">PostgreSQL</span>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="sql-host" className="mb-1.5 block text-xs font-medium text-slate-300">Host</label>
                  <Input id="sql-host" autoComplete="off" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="db.example.com" className="h-10 w-full border-white/10 bg-slate-800/60 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/30" />
                </div>
                <div>
                  <label htmlFor="sql-port" className="mb-1.5 block text-xs font-medium text-slate-300">Port</label>
                  <Input id="sql-port" inputMode="numeric" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} placeholder="5432" className="h-10 w-full border-white/10 bg-slate-800/60 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/30" />
                </div>
                <div>
                  <label htmlFor="sql-database" className="mb-1.5 block text-xs font-medium text-slate-300">Database name</label>
                  <Input id="sql-database" autoComplete="off" value={form.database} onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))} placeholder="analytics" className="h-10 w-full border-white/10 bg-slate-800/60 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/30" />
                </div>
                <div>
                  <label htmlFor="sql-username" className="mb-1.5 block text-xs font-medium text-slate-300">Username</label>
                  <Input id="sql-username" autoComplete="username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="readonly_user" className="h-10 w-full border-white/10 bg-slate-800/60 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/30" />
                </div>
                <div>
                  <label htmlFor="sql-password" className="mb-1.5 block text-xs font-medium text-slate-300">Password</label>
                  <Input id="sql-password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Enter password" className="h-10 w-full border-white/10 bg-slate-800/60 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/30" />
                </div>
              </div>
            </section>
            <label className="flex cursor-pointer items-start gap-3 border-t border-white/[0.07] pt-4">
              <input type="checkbox" checked={form.ssl} onChange={(e) => setForm((f) => ({ ...f, ssl: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/10 bg-slate-800 text-primary" />
              <span>
                <span className="block text-xs font-medium text-slate-200">Require SSL</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">Encrypt the connection to your database.</span>
              </span>
            </label>
          </div>
        ) : (
          <>
            <div className="mb-6 border-l-2 border-emerald-400 bg-emerald-500/[0.07] px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-400">{Icons.check}<span className="text-sm font-semibold">Connection successful</span></div>
              <p className="mt-1 text-xs text-emerald-300/70">{form.host} · {form.database}</p>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <div><h4 className="text-sm font-semibold text-slate-100">Choose tables</h4><p className="mt-1 text-xs text-slate-500">Select the tables agents may use.</p></div>
              <span className="text-xs text-slate-500">{selectedTables.length} selected</span>
            </div>
            <div className="space-y-1 border-y border-white/[0.07] py-2">
              {tables.map((table) => (
                <label key={table} className="flex cursor-pointer items-center gap-3 px-2 py-2.5 transition-colors hover:bg-white/[0.035]">
                  <input type="checkbox" checked={selectedTables.includes(table)} onChange={(e) => setSelectedTables((prev) => (e.target.checked ? [...prev, table] : prev.filter((item) => item !== table)))} className="h-4 w-4 rounded border-white/10 bg-slate-800 text-primary" />
                  <span className="text-xs text-slate-300">{table}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-white/[0.08] bg-[#0b101b] px-5 py-4 sm:px-7">
        {step === 'form' ? (
          <Button onClick={handleTest} disabled={testing || !form.host.trim() || !form.database.trim() || !form.username.trim() || !form.password} className="h-10 w-full gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {testing ? <>{Icons.spinner} Testing connection…</> : 'Test connection'}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStep('form')} className="h-10 rounded-md border-white/10 bg-transparent px-4 text-sm text-slate-300 hover:bg-white/5">Back</Button>
            <Button onClick={handleImport} disabled={selectedTables.length === 0} className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">Import {selectedTables.length} tables</Button>
          </>
        )}
      </footer>
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
          <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }} className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] py-12 text-center transition-colors hover:border-primary/30 hover:bg-primary/5">
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.parquet" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div className="text-slate-500">{Icons.upload}</div>
            <p className="text-sm font-medium text-white">Drop your file here</p>
            <p className="text-xs text-slate-500">Excel (.xlsx) · CSV · Parquet</p>
            <Button variant="outline" size="sm" className="mt-2 border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/5">Choose file</Button>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm font-semibold text-white">{fileName}</p>
              <p className="text-xs text-slate-500">Sheets</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sheets.map((s) => (
                  <button key={s} onClick={() => setSelectedSheets((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${selectedSheets.includes(s) ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</p>
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03]"><tr>{preview[0]?.map((h: string, i: number) => <th key={i} className="px-3 py-2 text-left font-medium text-slate-300">{h}</th>)}</tr></thead>
                  <tbody>{preview.slice(1).map((row, i) => <tr key={i} className="border-t border-white/[0.04]">{row.map((cell: string, j: number) => <td key={j} className="px-3 py-2 text-slate-400">{cell}</td>)}</tr>)}</tbody>
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
              <Button variant="outline" onClick={() => setStep('drop')} className="flex-1 border-white/10 bg-transparent text-slate-300 hover:bg-white/5">Back</Button>
              <Button onClick={handleImport} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">Import dataset</Button>
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
      setConnected(true);
      setSchema(res.schema);
      toast({ title: 'Connected' });
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
                  <select value={(form as any)[field.key]} onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))} className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 text-xs text-white outline-none focus:border-primary/30">
                    {field.options?.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input value={(form as any)[field.key]} onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder} className="h-9 border-white/10 bg-slate-800/50 text-xs text-white placeholder:text-slate-600 focus-visible:ring-primary/30" />
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
              <div className="flex items-center gap-2 text-emerald-400">{Icons.check}<span className="text-sm font-semibold">Connected</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-slate-500">Messages</p><p className="mt-0.5 font-semibold text-white">0 / min</p></div>
                <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-slate-500">Last message</p><p className="mt-0.5 font-semibold text-white">Just now</p></div>
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
              <Button variant="outline" onClick={() => setConnected(false)} className="flex-1 border-white/10 bg-transparent text-slate-300 hover:bg-white/5">Back</Button>
              <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">Save connection</Button>
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const source = await uploadDocument(file);
      onAdd(source);
      toast({ title: 'Document indexed', description: source.name });
      onClose();
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[420px] border-l border-white/[0.06] bg-slate-900/95 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-5">
        <h3 className="text-sm font-semibold text-white">Add documents</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{Icons.close}</button>
      </div>
      <div className="space-y-5 overflow-y-auto p-5">
        <>
          <div onClick={() => !uploading && fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !uploading) void handleFile(file); }} className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-12 text-center transition-colors hover:border-primary/30 hover:bg-primary/5">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])} />
            <div className="text-slate-500">{Icons.upload}</div>
            <p className="text-sm font-medium text-white">{uploading ? 'Extracting and saving…' : 'Drop a document here'}</p>
            <div className="flex gap-2 text-[10px] text-slate-500">
              <span className="rounded bg-white/5 px-2 py-0.5">PDF</span>
              <span className="rounded bg-white/5 px-2 py-0.5">Word</span>
              <span className="rounded bg-white/5 px-2 py-0.5">Text</span>
              <span className="rounded bg-white/5 px-2 py-0.5">Markdown</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">Extraction runs on the server. The saved record includes its summary and detected insights.</p>
        </>
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
  const [drawer, setDrawer] = useState<'sql' | 'excel' | 'document' | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'structured' | 'documents'>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchDataSources()
      .then((s) => setSources(s))
      .catch((e) => toast({ title: 'Failed to load sources', description: String(e), variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = sources.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || s.type === (filter === 'documents' ? 'document' : filter);
    return matchesSearch && matchesFilter;
  });

  const grouped = {
    structured: filtered.filter((s) => s.type === 'structured'),
    document: filtered.filter((s) => s.type === 'document'),
  };

  const handleAdd = (source: DataSource) => {
    setSources((prev) => [normalizeDataSource(source), ...prev]);
  };

  const handleMenuAction = async (id: string, action: string) => {
    if (action === 'Delete') {
      try {
        await deleteDataSource(id);
        setSources((prev) => prev.filter((s) => s.id !== id));
        toast({ title: 'Source removed' });
      } catch (e: any) {
        toast({ title: 'Remove failed', description: e.message, variant: 'destructive' });
      }
    }
  };

  const Section = ({ title, items }: { title: string; items: DataSource[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h3>
        <div className="space-y-2">
          {items.map((s) => (
            <SourceCard key={s.id} source={s} onAction={handleMenuAction} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-full" style={{ color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>TarQ · Schemas</p>
            <h1 className="text-2xl font-bold tracking-tight">Schemas</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Connect and manage schema sources for your dashboards and agents.</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-cyan))', boxShadow: '0 0 16px var(--accent-glow)' }}
          >
            {Icons.plus}
            Add schema
          </button>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{Icons.search}</span>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search schemas..." className="h-9 border-white/10 bg-slate-900/50 pl-9 text-sm text-white placeholder:text-slate-600 focus-visible:ring-primary/30" />
          </div>
          <div className="flex gap-2">
            {(['all', 'structured', 'documents'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${filter === f ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.02]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-slate-600">
            <div className="rounded-2xl bg-white/[0.02] p-6 ring-1 ring-white/5">{Icons.database}</div>
            <p className="text-sm">No schemas found</p>
            <Button variant="outline" onClick={() => setModalOpen(true)} className="border-white/10 bg-transparent text-xs text-slate-400 hover:bg-white/5 hover:text-white">Add your first schema</Button>
          </div>
        ) : (
          <>
            <Section title="Structured schemas" items={grouped.structured} />
            <Section title="Documents" items={grouped.document} />
          </>
        )}
      </div>

      {modalOpen && <AddDataModal onClose={() => setModalOpen(false)} onSelect={(t) => { setModalOpen(false); setDrawer(t as any); }} />}
      {drawer === 'sql' && <SQLConnectDrawer onClose={() => setDrawer(null)} onAdd={handleAdd} />}
      {drawer === 'excel' && <ExcelImportDrawer onClose={() => setDrawer(null)} onAdd={handleAdd} />}
      {drawer === 'document' && <DocumentUploadDrawer onClose={() => setDrawer(null)} onAdd={handleAdd} />}
    </div>
  );
}