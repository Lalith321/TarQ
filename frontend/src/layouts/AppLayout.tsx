import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AppLogConsole from '@/components/AppLogConsole';
import { readUserSettings, subscribeToUserSettings } from '@/services/userSettings';
import { installBrowserLogCapture } from '@/lib/appLogs';
import { Terminal } from 'lucide-react';

installBrowserLogCapture();

const navItems = [
  { path: '/app/dashboard', label: 'Dashboards', icon: LayoutGrid },
  { path: '/app/analyst',   label: 'Analysis',   icon: Bot },
  { path: '/app/documents', label: 'Schemas',    icon: FileText },
  { path: '/app/ml',        label: 'ML Lab',     icon: Brain },
];

function LayoutGrid({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/>
      <rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>
    </svg>
  );
}

function Bot({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>
    </svg>
  );
}

function FileText({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
      <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>
    </svg>
  );
}

function Brain({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 12h18M3 6h18M3 18h18"/>
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>
    </svg>
  );
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(() => readUserSettings().displayName);
  const location = useLocation();

  useEffect(() => subscribeToUserSettings(() => setDisplayName(readUserSettings().displayName)), []);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Sidebar ── */}
      <aside
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', boxShadow: '4px 0 24px rgba(0,0,0,0.18)' }}
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 ${collapsed ? 'w-[60px]' : 'w-[220px]'}`}
      >
        {/* Logo row */}
        <div className="flex h-14 items-center gap-3 px-4 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="relative flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="shrink-0 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]">
              <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" stroke="url(#sl)" strokeWidth="1.75" fill="rgba(99,102,241,0.15)"/>
              <circle cx="12" cy="12" r="3" fill="url(#sl)"/>
              <defs>
                <linearGradient id="sl" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">TarQ</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400/80">Intelligence & ML</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2 py-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active ? 'text-white' : 'hover:text-white'
                }`}
                style={active
                  ? { background: 'var(--bg-overlay)', color: 'var(--text-primary)', boxShadow: 'inset 3px 0 0 var(--accent)' }
                  : { color: 'var(--text-secondary)' }
                }
              >
                <item.icon className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <NavLink
            to="/app/settings/keys"
            title={collapsed ? 'User settings' : undefined}
            aria-label="User settings, API keys"
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"
            style={{ color: 'var(--text-primary)' }}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-cyan))' }}>
              {(displayName.trim()[0] || 'U').toUpperCase()}
            </div>
            {!collapsed && <div className="min-w-0 truncate text-xs font-medium">{displayName || 'User'}</div>}
          </NavLink>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header
          className="flex h-14 shrink-0 items-center justify-between px-5"
          style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              className="hidden rounded-lg p-1.5 transition-colors hover:bg-white/[0.08] active:scale-95 md:inline-flex"
              style={{ color: 'var(--text-secondary)' }}
            >
              <MenuIcon />
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">TarQ</span>
              <span className="text-slate-600">/</span>
              <span className="font-semibold text-slate-200">
                {location.pathname.includes('/ml')
                  ? 'ML Studio & SageMaker'
                  : location.pathname.includes('/analyst')
                  ? 'Agent Fleet Analysis'
                  : location.pathname.includes('/documents')
                  ? 'Schemas & Data Ingestion'
                  : location.pathname.includes('/settings')
                  ? 'Settings & Cloud Keys'
                  : 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Multi-Agent Fleet Active</span>
            </div>

            <NavLink
              to="/app/ml"
              className="hidden md:flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              <Brain className="h-3 w-3" />
              <span>AutoML & SageMaker</span>
            </NavLink>

            <button
              type="button"
              onClick={() => setLogsOpen((open) => !open)}
              aria-expanded={logsOpen}
              aria-controls="app-log-console"
              className="inline-flex h-8 items-center gap-2 rounded border px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-overlay)]"
              style={{
                borderColor: logsOpen ? 'var(--accent)' : 'var(--border-muted)',
                background: logsOpen ? 'var(--bg-overlay)' : 'transparent',
                color: logsOpen ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              title={logsOpen ? 'Close application logs' : 'Open application logs'}
            >
              <Terminal size={14} aria-hidden="true" />
              CMD
            </button>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>v2.5.0</span>
          </div>
        </header>

        {/* Page */}
        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6" style={{ background: 'var(--bg-base)' }}>
          <Outlet />
        </main>
        <AppLogConsole id="app-log-console" isOpen={logsOpen} onToggle={() => setLogsOpen((open) => !open)} />
        <nav aria-label="Primary navigation" className="grid grid-cols-5 border-t border-white/[0.08] bg-[var(--bg-surface)] md:hidden">
          {[...navItems, { path: '/app/settings/keys', label: 'User', icon: UserIcon }].map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors ${isActive ? 'text-white' : 'text-slate-500 hover:text-slate-200'}`}
              aria-label={item.label}
            >
              <item.icon className="h-[18px] w-[18px]" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
