import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatPanel } from './ChatPanel';
import { useDashboardAgent } from '../hooks/useDashboardAgent';
import WidgetRenderer from './widgets/WidgetRenderer';
import type { WidgetSpec, DashboardSpec } from '@/services/types';
import { fetchDashboard, updateDashboard, fetchDrillDown } from '@/services/dashboardService';

/* ═══════════════════════════════════════════════════════════════
   DUMMY API LAYER — Replace with real backend calls
   ═══════════════════════════════════════════════════════════════ */

export interface VideoItem {
  id: string;
  title: string;
  url: string;
  duration: number;
  uploadedAt: string;
}

export interface PresentationItem {
  id: string;
  title: string;
  slideCount: number;
  url: string;
  uploadedAt: string;
}

export interface UploadItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'icon';
  uploadedAt: string;
}

export interface WidgetConfig {
  title: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colorPalette?: string;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  smooth?: boolean;
  fillOpacity?: number;
}

// TODO: Replace with real API call
export const fetchDashboardMedia = async (_dashboardId: string): Promise<{ videos: VideoItem[]; presentations: PresentationItem[] }> => {
  return { videos: [], presentations: [] };
};

// TODO: Replace with real API call
export const fetchDashboardUploads = async (_dashboardId: string): Promise<UploadItem[]> => {
  return [];
};

// TODO: Replace with real API call
export const uploadFile = async (_dashboardId: string, file: File): Promise<UploadItem> => {
  return {
    id: `u_${Date.now()}`,
    name: file.name,
    url: URL.createObjectURL(file),
    type: file.type.startsWith('image/') ? 'image' : 'icon',
    uploadedAt: new Date().toISOString(),
  };
};

// TODO: Replace with real API call
export const createWidget = async (
  _dashboardId: string,
  widgetType: string,
  config: WidgetConfig
): Promise<WidgetSpec> => {
  return {
    id: `widget_${Date.now()}`,
    type: widgetType,
    title: config.title,
    config,
    data: [],
    position: { x: 0, y: 0, w: 6, h: 4 },
    drill_down: { enabled: false, key_fields: [], result_widget_type: 'table', title_template: '{{value}}' },
  } as unknown as WidgetSpec;
};

// TODO: Replace with real API call
export const refreshDashboardData = async (_dashboardId: string): Promise<void> => {};

/* ═══════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════ */

const Icons = {
  back: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
  ),
  save: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
  ),
  agent: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
  ),
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
  ),
  video: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
  ),
  presentation: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h20M12 3v18M7 21h10" /><rect x="6" y="8" width="12" height="8" rx="1" /></svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
  ),
  spinner: (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
  ),
  image: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */

function Toast({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className={`flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium shadow-2xl backdrop-blur-xl border ${
        type === 'success' ? 'bg-emerald-500/95 text-white border-emerald-400/30' : 'bg-red-500/95 text-white border-red-400/30'
      }`}>
        {type === 'success' ? Icons.check : Icons.error}
        {message}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR SECTION
   ═══════════════════════════════════════════════════════════════ */

function SidebarSection({ title, icon, defaultOpen = true, children }: { title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-200"
      >
        <span className="text-slate-500">{icon}</span>
        {title}
        <span className={`ml-auto transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>{Icons.chevronDown}</span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3 pb-4">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONFIG DRAWER — Edit existing widget
   ═══════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'appearance' as const, label: 'Appearance' },
  { id: 'labels' as const, label: 'Labels' },
] as const;

function ConfigDrawer({
  widget,
  onClose,
  onSave,
}: {
  widget: WidgetSpec;
  onClose: () => void;
  onSave: (config: WidgetConfig) => void;
}) {
  const [config, setConfig] = useState<WidgetConfig>(() => {
    const w = widget as any;
    return {
      title: w.title || 'Widget',
      xAxisLabel: w.config?.xAxisLabel || '',
      yAxisLabel: w.config?.yAxisLabel || '',
      colorPalette: w.config?.colorPalette || 'default',
      showLegend: w.config?.showLegend ?? true,
      legendPosition: w.config?.legendPosition || 'bottom',
      smooth: w.config?.smooth ?? true,
      fillOpacity: w.config?.fillOpacity ?? 0.3,
    };
  });

  const [activeTab, setActiveTab] = useState<'appearance' | 'labels'>('appearance');

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  return (
    <div className="absolute inset-y-0 left-0 z-40 w-80 border-r border-white/5 bg-slate-900/95 backdrop-blur-2xl shadow-2xl">
      <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
        <h3 className="text-sm font-semibold text-white">Edit Widget</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{Icons.close}</button>
      </div>

      <div className="flex border-b border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-5 overflow-y-auto p-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Title</label>
          <Input
            value={config.title}
            onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
            className="h-9 border-white/10 bg-slate-800/50 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/50"
          />
        </div>

        {activeTab === 'appearance' && (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Color Palette</label>
              <div className="flex gap-2">
                {['default', 'ocean', 'sunset', 'forest', 'mono'].map((palette) => (
                  <button
                    key={palette}
                    onClick={() => setConfig((c) => ({ ...c, colorPalette: palette }))}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      config.colorPalette === palette ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{
                      background:
                        palette === 'default' ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                        : palette === 'ocean' ? 'linear-gradient(135deg, #06b6d4, #3b82f6)'
                        :                        palette === 'sunset' ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                        : palette === 'forest' ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'linear-gradient(135deg, #64748b, #94a3b8)',
                    }}
                    title={palette}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Smooth Lines</label>
              <button
                onClick={() => setConfig((c) => ({ ...c, smooth: !c.smooth }))}
                className={`relative h-5 w-9 rounded-full transition-colors ${config.smooth ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${config.smooth ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Show Legend</label>
              <button
                onClick={() => setConfig((c) => ({ ...c, showLegend: !c.showLegend }))}
                className={`relative h-5 w-9 rounded-full transition-colors ${config.showLegend ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${config.showLegend ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            {config.showLegend && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Legend Position</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setConfig((c) => ({ ...c, legendPosition: pos }))}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                        config.legendPosition === pos
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-white/5 bg-slate-800/30 text-slate-400 hover:border-white/10'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'labels' && (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">X Axis Label</label>
              <Input
                value={config.xAxisLabel}
                onChange={(e) => setConfig((c) => ({ ...c, xAxisLabel: e.target.value }))}
                placeholder="e.g. Month"
                className="h-9 border-white/10 bg-slate-800/50 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Y Axis Label</label>
              <Input
                value={config.yAxisLabel}
                onChange={(e) => setConfig((c) => ({ ...c, yAxisLabel: e.target.value }))}
                placeholder="e.g. Revenue ($)"
                className="h-9 border-white/10 bg-slate-800/50 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/50"
              />
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 bg-slate-900/95 p-4 backdrop-blur-xl">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEDIA MODAL
   ═══════════════════════════════════════════════════════════════ */

function MediaModal({ item, type, onClose }: { item: VideoItem | PresentationItem; type: 'video' | 'presentation'; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">{item.title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
            {Icons.close}
          </button>
        </div>
        <div className="aspect-video bg-black flex items-center justify-center">
          <p className="text-sm text-slate-400">
            {type === 'video' ? 'Video player' : 'Presentation viewer'} — URL: {item.url}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function DashboardBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dashboardId = searchParams.get('id') ?? undefined;
  const isQuick = searchParams.get('quick') === '1';

  const [dashboard, setDashboard] = useState<DashboardSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetSpec | null>(null);

  const [media, setMedia] = useState<{ videos: VideoItem[]; presentations: PresentationItem[] } | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [activeMedia, setActiveMedia] = useState<{ item: VideoItem | PresentationItem; type: 'video' | 'presentation' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useMemo(() => `sess_${Date.now()}`, []);

  const { messages, sending, sendMessage, clearMessages } = useDashboardAgent(sessionId, {
    dashboardId,
    onWidgetGenerated: (widget) => addWidget(widget),
  });

  /* ── Data Fetching ── */
  useEffect(() => {
    if (!dashboardId) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetchDashboard(dashboardId),
      fetchDashboardMedia(dashboardId),
      fetchDashboardUploads(dashboardId),
    ])
      .then(([d, m, u]) => {
        setDashboard(d);
        setMedia(m);
        setUploads(u);
      })
      .catch(() => setDashboard(null))
      .finally(() => setLoading(false));
  }, [dashboardId]);

  /* ── Actions ── */
  const addWidget = useCallback((widget: WidgetSpec) => {
    setDashboard((prev) => (prev ? { ...prev, widgets: [...prev.widgets, widget] } : prev));
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    setDashboard((prev) => (prev ? { ...prev, widgets: prev.widgets.filter((w) => w.id !== widgetId) } : prev));
  }, []);

  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetSpec>) => {
    setDashboard((prev) =>
      prev
        ? { ...prev, widgets: prev.widgets.map((w) => (w.id === widgetId ? { ...w, ...updates } : w)) }
        : prev
    );
  }, []);

  const saveDashboard = async () => {
    if (!dashboard) return;
    setSaving(true);
    try {
      await updateDashboard(dashboard.id, {
        title: dashboard.title,
        description: dashboard.description,
        widgets: dashboard.widgets,
      });
      setToast({ message: 'Dashboard saved', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (!dashboardId) return;
    setRefreshing(true);
    try {
      await refreshDashboardData(dashboardId);
      const d = await fetchDashboard(dashboardId);
      setDashboard(d);
      setToast({ message: 'Dashboard refreshed', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message || 'Refresh failed', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDrillDown = async (widget: WidgetSpec, row: Record<string, any>) => {
    if (!dashboard) return;
    try {
      const drillWidget = await fetchDrillDown(dashboard.id, widget.id, row);
      addWidget(drillWidget);
      setToast({ message: 'Drill-down added', type: 'success' });
    } catch (e: any) {
      setToast({ message: `Drill-down failed: ${e.message}`, type: 'error' });
    }
  };

  const handleWidgetEdit = (config: WidgetConfig) => {
    if (!editingWidget) return;
    updateWidget(editingWidget.id, {
      title: config.title,
    });
    setEditingWidget(null);
    setToast({ message: 'Widget updated', type: 'success' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dashboardId) return;
    try {
      const uploaded = await uploadFile(dashboardId, file);
      setUploads((prev) => [uploaded, ...prev]);
      setToast({ message: `${file.name} uploaded`, type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message || 'Upload failed', type: 'error' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-slate-950">
        <div className="h-16 border-b border-white/5 bg-slate-950/60 backdrop-blur-2xl" />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-white/5 bg-slate-900/50" />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
                  <div className="mb-5 h-4 w-32 animate-pulse rounded-lg bg-slate-800" />
                  <div className="h-48 w-full animate-pulse rounded-xl bg-slate-800/70" />
                </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Not Found ── */
  if (!dashboard) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 bg-slate-950">
        <div className="rounded-3xl bg-red-500/10 p-6 ring-1 ring-red-500/20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold text-white">Dashboard not found</p>
          <p className="mt-1 text-sm text-slate-400">The dashboard you're looking for doesn't exist.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="rounded-full border-white/10 bg-transparent px-6 text-slate-300 hover:bg-white/5 hover:text-white">
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* ═════ HEADER ═════ */}
      <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-slate-950/60 px-5 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-9 w-9 rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="h-9 w-9 rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            {Icons.back}
          </Button>

          <div className="flex items-center gap-3">
            <Input
              value={dashboard.title}
              onChange={(e) => setDashboard((p) => (p ? { ...p, title: e.target.value } : p))}
              className="h-9 w-64 border-none bg-transparent text-lg font-bold tracking-tight text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 transition-all"
              placeholder="Untitled Dashboard"
            />
            {isQuick && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Quick
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2 rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            {refreshing ? Icons.spinner : Icons.refresh}
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            onClick={saveDashboard}
            disabled={saving}
            className="relative h-9 gap-2 rounded-full bg-white px-5 text-sm font-medium text-slate-950 shadow-lg shadow-white/10 transition-all hover:shadow-xl hover:shadow-white/15 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <>{Icons.spinner} Saving…</> : <>{Icons.save} Save</>}
          </Button>
        </div>
      </header>

      {/* ═════ MAIN ═════ */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ── LEFT SIDEBAR ── */}
        <aside
          className={`absolute inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-white/5 bg-slate-900/80 backdrop-blur-xl transition-transform duration-300 lg:relative lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
            <span className="text-sm font-semibold text-white">Toolbar</span>
            <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden">
              {Icons.close}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Uploads Section */}
            <SidebarSection title="Uploads" icon={Icons.upload} defaultOpen={true}>
              <div className="space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-slate-800/20 py-6 text-xs font-medium text-slate-400 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  {Icons.upload}
                  Click or drop files
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,.svg,.png,.jpg,.jpeg" className="hidden" onChange={handleFileUpload} />

                {uploads.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {uploads.map((u) => (
                      <div key={u.id} className="group relative aspect-square overflow-hidden rounded-lg border border-white/5 bg-slate-800/30">
                        <img src={u.url} alt={u.name} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="truncate text-[9px] text-white">{u.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SidebarSection>

            {/* Media Section */}
            <SidebarSection title="Media" icon={Icons.video} defaultOpen={false}>
              <div className="space-y-3">
                {media && media.videos.length > 0 && (
                  <div>
                    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Videos</p>
                    <div className="space-y-2">
                      {media.videos.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setActiveMedia({ item: v, type: 'video' })}
                          className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-slate-800/20 p-2.5 text-left transition-all hover:border-white/10 hover:bg-slate-800/40"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                            {Icons.video}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-200">{v.title}</p>
                            <p className="text-[10px] text-slate-500">{Math.floor(v.duration / 60)}:{String(v.duration % 60).padStart(2, '0')}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {media && media.presentations.length > 0 && (
                  <div>
                    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Presentations</p>
                    <div className="space-y-2">
                      {media.presentations.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setActiveMedia({ item: p, type: 'presentation' })}
                          className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-slate-800/20 p-2.5 text-left transition-all hover:border-white/10 hover:bg-slate-800/40"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                            {Icons.presentation}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-200">{p.title}</p>
                            <p className="text-[10px] text-slate-500">{p.slideCount} slides</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SidebarSection>
          </div>
        </aside>

        {sidebarOpen && <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* ── CONFIG DRAWER ── */}
        {editingWidget && (
          <ConfigDrawer widget={editingWidget} onClose={() => setEditingWidget(null)} onSave={handleWidgetEdit} />
        )}

        {/* ── MAIN CANVAS ── */}
        <main className="relative flex-1 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
          <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative p-6">
            {dashboard.widgets.length === 0 ? (
              <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-6">
                <div className="relative">
                  <div className="absolute -inset-12 rounded-full bg-primary/5 blur-3xl" />
                  <div className="relative rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-10 ring-1 ring-primary/10 backdrop-blur-sm">
                    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-primary/80">
                      <rect x="3" y="3" width="7" height="7" rx="2" className="animate-[pulse_3s_ease-in-out_infinite]" />
                      <rect x="14" y="3" width="7" height="7" rx="2" className="animate-[pulse_3s_ease-in-out_0.6s_infinite]" />
                      <rect x="3" y="14" width="7" height="7" rx="2" className="animate-[pulse_3s_ease-in-out_1.2s_infinite]" />
                      <rect x="14" y="14" width="7" height="7" rx="2" className="animate-[pulse_3s_ease-in-out_1.8s_infinite]" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-semibold tracking-tight text-white">Your dashboard is empty</h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                    Ask the <span className="font-medium text-primary">Data Agent</span> to generate widgets for you.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                {dashboard.widgets.map((widget, idx) => (
                  <div
                    key={widget.id}
                    className="group relative animate-in fade-in zoom-in-95 fill-mode-backwards"
                    style={{ animationDelay: `${Math.min(idx * 100, 500)}ms`, animationDuration: '400ms' }}
                  >
                    {/* Hover actions */}
                    <div className="absolute -right-2.5 -top-2.5 z-20 flex gap-1.5 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                      <button
                        onClick={() => setEditingWidget(widget)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white shadow-lg ring-2 ring-slate-950 transition-all hover:scale-110 hover:bg-slate-600"
                        title="Edit widget"
                      >
                        {Icons.edit}
                      </button>
                      <button
                        onClick={() => removeWidget(widget.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/25 ring-2 ring-slate-950 transition-all hover:scale-110 hover:bg-red-400"
                        title="Remove widget"
                      >
                        {Icons.trash}
                      </button>
                    </div>

                    <div className="h-full overflow-hidden rounded-2xl border border-white/5 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 hover:border-white/10">
                      <WidgetRenderer
                        widget={widget}
                        onDrillDown={widget.drill_down?.enabled ? handleDrillDown : undefined}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ── RIGHT AGENT PANEL ── */}
        <div
          className={`absolute inset-y-0 right-0 z-20 flex w-[380px] flex-col border-l border-white/5 bg-slate-900/95 backdrop-blur-2xl shadow-2xl transition-transform duration-300 lg:relative ${
            agentOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Data Agent</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">AI</span>
            </div>
            <button onClick={() => setAgentOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
              {Icons.close}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel messages={messages} sending={sending} onSend={sendMessage} onClear={clearMessages} onAddWidgetFromChat={addWidget} />
          </div>
        </div>

        {/* Agent Floating Button */}
        {!agentOpen && (
          <button
            onClick={() => setAgentOpen(true)}
            className="absolute bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-110 hover:shadow-2xl hover:shadow-primary/30 active:scale-95"
          >
            {Icons.agent}
          </button>
        )}
      </div>

      {/* ── MEDIA MODAL ── */}
      {activeMedia && <MediaModal item={activeMedia.item} type={activeMedia.type} onClose={() => setActiveMedia(null)} />}

      {/* ── TOAST ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}