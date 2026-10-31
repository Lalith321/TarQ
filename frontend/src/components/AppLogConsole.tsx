import { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/apiEndpoints';
import {
  clearAppLogs,
  recordBackendLog,
  subscribeAppLogs,
  type AppLogEntry,
} from '@/lib/appLogs';

type BackendStatus = 'connecting' | 'connected' | 'offline';

interface AppLogConsoleProps {
    id?: string;
  isOpen: boolean;
  onToggle: () => void;
}

const LEVEL_STYLES: Record<string, string> = {
  log: 'var(--text-secondary)',
  info: 'var(--accent)',
  warn: 'var(--status-warn)',
  error: 'var(--status-err)',
};

export default function AppLogConsole({ id, isOpen, onToggle }: AppLogConsoleProps) {
  const [entries, setEntries] = useState<AppLogEntry[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('connecting');
  const logViewport = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);

  useEffect(() => {
    const unsub = subscribeAppLogs(setEntries);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let reconnectTimer = 0;
    let socket: WebSocket | undefined;

    const connect = () => {
      if (stopped) return;
      setBackendStatus('connecting');
      socket = new WebSocket(`${API_BASE_URL.replace(/^http/, 'ws')}/logs/ws`);
      socket.onopen = () => setBackendStatus('connected');
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'log') {
            recordBackendLog(payload.level ?? 'info', payload.logger ?? '', payload.message ?? '');
          }
        } catch {
          console.warn('Ignored malformed backend log event');
        }
      };
      socket.onclose = () => {
        setBackendStatus('offline');
        if (!stopped) reconnectTimer = window.setTimeout(connect, 3000);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    if (followOutput.current) logViewport.current?.scrollTo({ top: logViewport.current.scrollHeight });
  }, [entries, isOpen]);

  return (
    <section id={id} className="shrink-0 border-t font-mono text-xs" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
      {isOpen ? (
        <>
          <div className="flex h-10 items-center justify-between border-b px-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Terminal size={14} aria-hidden="true" /> Logs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" title={`Log stream ${backendStatus}`} style={{ background: backendStatus === 'connected' ? 'var(--status-ok)' : backendStatus === 'connecting' ? 'var(--status-warn)' : 'var(--text-muted)' }} />
              <button onClick={clearAppLogs} title="Clear logs" aria-label="Clear logs" className="rounded p-1.5 transition-colors hover:bg-[var(--bg-overlay)]" style={{ color: 'var(--text-muted)' }}>
                <Trash2 size={14} />
              </button>
              <button onClick={onToggle} title="Close logs" aria-label="Close logs" className="rounded p-1.5 transition-colors hover:bg-[var(--bg-overlay)]" style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>
          </div>
          <div
            ref={logViewport}
            onScroll={(event) => {
              const element = event.currentTarget;
              followOutput.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32;
            }}
            className="h-56 overflow-y-auto px-3 py-2"
            aria-live="polite"
          >
            {entries.length ? entries.map((entry) => (
              <div key={entry.id} className="grid grid-cols-[70px_52px_minmax(0,1fr)] gap-2 py-0.5 leading-relaxed">
                <span style={{ color: 'var(--text-muted)' }}>{entry.time}</span>
                <span className="uppercase" style={{ color: LEVEL_STYLES[entry.level] ?? 'var(--text-secondary)' }}>{entry.level}</span>
                <span className="whitespace-pre-wrap break-all" style={{ color: 'var(--text-primary)' }}>{entry.message}</span>
              </div>
            )) : (
              <p className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>No logs yet</p>
            )}
          </div>
        </>
      ) : (
        <button onClick={onToggle} aria-expanded={false} className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs font-semibold transition-colors hover:bg-[var(--bg-overlay)]" style={{ color: 'var(--text-secondary)' }}>
          <Terminal size={13} aria-hidden="true" />
          <span>CMD Console</span>
          <span style={{ color: 'var(--text-muted)' }}>{entries.length.toLocaleString()} logs</span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: backendStatus === 'connected' ? 'var(--status-ok)' : backendStatus === 'connecting' ? 'var(--status-warn)' : 'var(--text-muted)' }} title={`Log stream ${backendStatus}`} />
        </button>
      )}
    </section>
  );
}