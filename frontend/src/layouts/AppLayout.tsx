import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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

function Sparkles({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
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
  const navigate = useNavigate();

  useEffect(() => subscribeToUserSettings(() => setDisplayName(readUserSettings().displayName)), []);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Sidebar ── */}
      <aside
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)' }}
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 ${collapsed ? 'w-[60px]' : 'w-[220px]'}`}
      >
        {/* Logo row */}
        <div className="flex h-14 items-center gap-3 px-4 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" stroke="url(#sl)" strokeWidth="1.5" fill="rgba(59,130,246,0.12)"/>
            <circle cx="12" cy="12" r="3" fill="url(#sl)"/>
            <defs>
              <linearGradient id="sl" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>TarQ</span>
          )}
        </div>

        {/* Ask Agent CTA */}
        <div className="px-3 py-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/app/analyst')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-cyan) 100%)', boxShadow: '0 4px 16px var(--accent-glow)' }}
          >
            <Sparkles className="shrink-0" />
            {!collapsed && <span>Ask Agent</span>}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2 py-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'text-white' : 'hover:text-white'
                }`}
                style={active
                  ? { background: 'var(--bg-overlay)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-secondary)' }
                }
              >
                <item.icon className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {active && !collapsed && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                )}
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
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="hidden rounded-md p-1.5 transition-colors hover:bg-white/[0.06] md:inline-flex"
            style={{ color: 'var(--text-secondary)' }}
          >
            <MenuIcon />
          </button>
          <div className="flex items-center gap-3">
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
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>v2.4.0</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Workspace</span>
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
