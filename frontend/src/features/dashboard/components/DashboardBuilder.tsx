import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChatPanel } from './ChatPanel';
import { useDashboardAgent } from '../hooks/useDashboardAgent';
import WidgetRenderer from './widgets/WidgetRenderer';
import type { CanvasPoint, CanvasStroke, WidgetSpec, DashboardSpec } from '@/services/types';
import { fetchDashboard, updateDashboard, fetchDrillDown } from '@/services/dashboardService';
import { fetchDataSources } from '@/services/dataSourceService';
import type { DataSource } from '@/services/dataSourceService';
import { fetchGeneratedArtifacts } from '@/services/artifactService';
import type { GeneratedArtifact } from '@/services/artifactService';
import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { SelectedAnalystSource } from '@/services/analystService';
import { fetchAgentFleets } from '@/services/agentConfigService';
import type { AgentFleet } from '@/services/agentConfigService';

/* ── Grid ── */
const COLS = 12;
const CW = 110;   // column width px
const RH = 90;    // row height px
const G  = 10;    // gap px
const CX = CW + G;
const RX = RH + G;

export function gridToPx(x: number, y: number, w: number, h: number) {
  return { left: x * CX, top: y * RX, width: w * CW + (w - 1) * G, height: h * RH + (h - 1) * G };
}

/* ── Stable per-widget color seeded from id ── */
const COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316','#6366f1'];
export function widgetColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export interface WidgetConfig { title: string; }

/* ── Icons ── */
const I = {
  back:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  save:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  agent:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>,
  close:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  check:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  err:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  spin:    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>,
  chat:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  upload:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  file:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
};

function Toast({ message, type, onClose }: { message: string; type: 'success'|'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const ok = type === 'success';
  return (
    <div className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-medium shadow-2xl backdrop-blur-xl"
      style={{ background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: ok ? '#34d399' : '#f87171' }}>
      {ok ? I.check : I.err}{message}
    </div>
  );
}

function ConfigDrawer({ widget, onClose, onSave }: { widget: WidgetSpec; onClose: () => void; onSave: (c: WidgetConfig) => void }) {
  const [title, setTitle] = useState(widget.title);
  return (
    <div className="absolute inset-y-0 left-0 z-40 flex w-64 flex-col shadow-2xl"
      style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Edit Widget</span>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>{I.close}</button>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-xs outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-muted)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="flex gap-2 p-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <button onClick={onClose} className="flex-1 rounded-lg py-2 text-xs font-medium"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button onClick={() => { onSave({ title }); onClose(); }} className="flex-1 rounded-lg py-2 text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>Apply</button>
      </div>
    </div>
  );
}

/* ── Drawing ── */
type DrawTool = 'pen' | 'brush' | 'marker' | 'eraser';
interface DrawState { tool: DrawTool; color: string; size: number; active: boolean; }
const STROKE_SMOOTHING = 0.08;
const CORNER_TURN_COSINE = 0.72;
const MIN_CORNER_SEGMENT = 4;

function isSharpTurn(incoming: CanvasPoint, outgoing: CanvasPoint): boolean {
  const incomingLength = Math.hypot(incoming.x, incoming.y);
  const outgoingLength = Math.hypot(outgoing.x, outgoing.y);
  if (incomingLength < MIN_CORNER_SEGMENT || outgoingLength < MIN_CORNER_SEGMENT) return false;
  const cosine = (incoming.x * outgoing.x + incoming.y * outgoing.y) / (incomingLength * outgoingLength);
  return cosine < CORNER_TURN_COSINE;
}

function smoothStrokePoints(rawPoints: CanvasPoint[]): CanvasPoint[] {
  if (rawPoints.length < 3) return rawPoints;

  const points = [rawPoints[0]];
  let smoothed = rawPoints[0];
  for (let index = 1; index < rawPoints.length - 1; index++) {
    const previous = rawPoints[index - 1];
    const current = rawPoints[index];
    const next = rawPoints[index + 1];
    const incoming = { x: current.x - previous.x, y: current.y - previous.y };
    const outgoing = { x: next.x - current.x, y: next.y - current.y };
    const following = rawPoints[index + 2];
    const afterFollowing = rawPoints[index + 3];
    const sustained = following && afterFollowing && isSharpTurn(incoming, outgoing)
      && !isSharpTurn(outgoing, { x: following.x - next.x, y: following.y - next.y })
      && !isSharpTurn(outgoing, { x: afterFollowing.x - following.x, y: afterFollowing.y - following.y });

    if (sustained) {
      smoothed = current;
    } else {
      smoothed = {
        x: smoothed.x + (current.x - smoothed.x) * STROKE_SMOOTHING,
        y: smoothed.y + (current.y - smoothed.y) * STROKE_SMOOTHING,
      };
    }
    points.push(smoothed);
  }

  points.push(rawPoints[rawPoints.length - 1]);
  return points;
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: CanvasStroke) {
  const points = stroke.points;
  if (!points.length) return;

  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = stroke.tool === 'marker' ? 0.55 : 1;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size * (stroke.tool === 'brush' ? 3 : 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index++) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/* ── Ghost type ── */
interface Ghost { id: string; left: number; top: number; width: number; height: number; }
type DashboardSavePayload = Pick<DashboardSpec, 'title' | 'description' | 'widgets' | 'drawings'>;

function dashboardSavePayload(dashboard: DashboardSpec): DashboardSavePayload {
  return {
    title: dashboard.title,
    description: dashboard.description,
    widgets: dashboard.widgets,
    drawings: dashboard.drawings ?? [],
  };
}

function dashboardSaveSnapshot(dashboard: DashboardSpec): string {
  return JSON.stringify(dashboardSavePayload(dashboard));
}

/* ── Main ── */
export function DashboardBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dashboardId = searchParams.get('id') ?? undefined;
  const isNew = searchParams.get('new') === '1';

  const [dashboard, setDashboard] = useState<DashboardSpec | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast]         = useState<{ message: string; type: 'success'|'error' } | null>(null);
  const [chatOpen, setChatOpen]   = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(0);
  const [availableSources, setAvailableSources] = useState<DataSource[]>([]);
  const [agentFleets, setAgentFleets] = useState<AgentFleet[]>([]);
  const [selectedFleetId, setSelectedFleetId] = useState('');
  const [selectedSources, setSelectedSources] = useState<Record<string, string[]>>({});
  const [editingWidget, setEditingWidget] = useState<WidgetSpec | null>(null);
  const [fullscreenWidget, setFullscreenWidget] = useState<string | null>(null);
  const [ghost, setGhost]         = useState<Ghost | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<{ id: string; name: string; type: string; size: string }[]>([]);
  const [outputs, setOutputs] = useState<GeneratedArtifact[]>([]);
  const [draw, setDraw] = useState<DrawState>({ tool: 'pen', color: '#3b82f6', size: 3, active: false });
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const lastPt      = useRef<CanvasPoint | null>(null);
  const rawStrokePoints = useRef<CanvasPoint[]>([]);
  const activeStroke = useRef<CanvasStroke | null>(null);
  const drawingHistory = useRef<{ past: CanvasStroke[][]; future: CanvasStroke[][] }>({ past: [], future: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const persistedSnapshotRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestDashboardRef = useRef(dashboard);
  latestDashboardRef.current = dashboard;

  const persistDashboard = useCallback((target: DashboardSpec) => {
    const payload = dashboardSavePayload(target);
    const snapshot = JSON.stringify(payload);
    const request = saveQueueRef.current.catch(() => undefined).then(async () => {
      if (persistedSnapshotRef.current === snapshot) return;
      await updateDashboard(target.id, payload);
      persistedSnapshotRef.current = snapshot;
    });
    saveQueueRef.current = request;
    return request;
  }, []);

  const canvasRows = Math.max(8, ...(dashboard?.widgets ?? []).map(w => (w.position?.y ?? 0) + (w.position?.h ?? 4)));
  const canvasH = canvasRows * RX + 120;
  const canvasW = COLS * CX;

  const sessionId = useMemo(() => `sess_${Date.now()}`, []);
  const addGeneratedWidgets = useCallback((widgets: WidgetSpec[]) => {
    setDashboard((current) => {
      if (!current) return current;
      const knownIds = new Set(current.widgets.map((widget) => widget.id));
      const newWidgets = widgets.filter((widget) => !knownIds.has(widget.id)).map((widget, index) => ({
        ...widget,
        position: widget.position ?? { x: 0, y: (current.widgets.length + index) * 4, w: 6, h: 4 },
      }));
      return newWidgets.length ? { ...current, widgets: [...current.widgets, ...newWidgets] } : current;
    });
  }, []);
  const selectedAnalystSources: SelectedAnalystSource[] = Object.entries(selectedSources).map(([schema_id, tables]) => ({ schema_id, tables }));
  const { messages, sending, sendMessage, stopMessage } = useDashboardAgent(sessionId, { dashboardId, onDashboardGenerated: addGeneratedWidgets, selectedSources: selectedAnalystSources, fleetId: selectedFleetId || undefined });

  useEffect(() => {
    fetchDataSources().then(setAvailableSources).catch(() => setAvailableSources([]));
  }, []);

  useEffect(() => {
    let active = true;
    const loadArtifacts = () => {
      fetchGeneratedArtifacts().then((items) => {
        if (active) setOutputs(items);
      }).catch(() => undefined);
    };
    loadArtifacts();
    const interval = window.setInterval(loadArtifacts, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchAgentFleets()
      .then(({ fleets, activeFleetId }) => {
        setAgentFleets(fleets);
        setSelectedFleetId((current) => current || activeFleetId);
      })
      .catch(() => setAgentFleets([]));
  }, []);

  useEffect(() => {
    const consoleElement = document.getElementById('builder-log-console');
    if (!consoleElement) return;

    const updateHeight = () => setConsoleHeight(Math.ceil(consoleElement.getBoundingClientRect().height));
    const observer = new ResizeObserver(updateHeight);
    updateHeight();
    observer.observe(consoleElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dashboardId) { setLoading(false); return; }
    persistedSnapshotRef.current = null;
    setLoading(true);
    fetchDashboard(dashboardId).then((loaded) => {
      persistedSnapshotRef.current = dashboardSaveSnapshot(loaded);
      setDashboard(loaded);
    }).catch(() => setDashboard(null)).finally(() => setLoading(false));
  }, [dashboardId]);

  useEffect(() => {
    if (!dashboard || loading || persistedSnapshotRef.current === null) return;
    const snapshot = dashboardSaveSnapshot(dashboard);
    if (snapshot === persistedSnapshotRef.current) return;

    setAutosaveStatus('pending');
    const timer = window.setTimeout(() => {
      setAutosaveStatus('saving');
      void persistDashboard(dashboard).then(() => {
        const latest = latestDashboardRef.current;
        if (latest && dashboardSaveSnapshot(latest) === persistedSnapshotRef.current)
          setAutosaveStatus('saved');
      }).catch(() => setAutosaveStatus('error'));
    }, 800);

    return () => window.clearTimeout(timer);
  }, [dashboard, loading, persistDashboard]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveDashboard(); }
      if (draw.active && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoDrawing();
        else undoDrawing();
      }
      if (e.key === 'd' && !(e.ctrlKey || e.metaKey) && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')
        setDraw(p => ({ ...p, active: !p.active }));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  /* Redraw vector strokes onto the full artboard after layout or DPR changes. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dashboard) return;

    const redraw = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvasW * dpr);
      canvas.height = Math.round(canvasH * dpr);
      canvas.style.width = `${canvasW}px`;
      canvas.style.height = `${canvasH}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      (dashboard.drawings ?? []).forEach(stroke => paintStroke(ctx, stroke));
      if (activeStroke.current) paintStroke(ctx, activeStroke.current);
    };

    redraw();
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [dashboard?.id, dashboard?.drawings, canvasW, canvasH]);

  /* drawing handlers */
  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;
  const canvasPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDrawDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draw.active || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = canvasPt(e);
    lastPt.current = pt;
    rawStrokePoints.current = [pt];
    activeStroke.current = { tool: draw.tool, color: draw.color, size: draw.size, points: [pt] };
    const ctx = getCtx();
    if (ctx) paintStroke(ctx, activeStroke.current);
  };
  const onDrawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = activeStroke.current;
    let previousPoint = lastPt.current;
    if (!stroke || !previousPoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nativeEvents = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const ctx = getCtx();
    for (const event of nativeEvents) {
      const rawPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      rawStrokePoints.current.push(rawPoint);
      const point: CanvasPoint = {
        x: previousPoint.x + (rawPoint.x - previousPoint.x) * STROKE_SMOOTHING,
        y: previousPoint.y + (rawPoint.y - previousPoint.y) * STROKE_SMOOTHING,
      };
      stroke.points.push(point);
      if (ctx) {
        ctx.save();
        ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.globalAlpha = stroke.tool === 'marker' ? 0.55 : 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * (stroke.tool === 'brush' ? 3 : 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(previousPoint.x, previousPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        ctx.restore();
      }
      lastPt.current = point;
      previousPoint = point;
    }
  };
  const onDrawUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = activeStroke.current;
    if (!stroke) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const endpoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const previousPoint = lastPt.current;
    if (previousPoint && Math.hypot(endpoint.x - previousPoint.x, endpoint.y - previousPoint.y) > 0.5)
      rawStrokePoints.current.push(endpoint);
    stroke.points = smoothStrokePoints(rawStrokePoints.current);

    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      (dashboard?.drawings ?? []).forEach(existingStroke => paintStroke(ctx, existingStroke));
      paintStroke(ctx, stroke);
    }
    activeStroke.current = null;
    lastPt.current = null;
    rawStrokePoints.current = [];
    drawingHistory.current.past.push(dashboard?.drawings ?? []);
    drawingHistory.current.future = [];
    setDashboard(current => current ? { ...current, drawings: [...(current.drawings ?? []), stroke] } : current);
  };

  const undoDrawing = () => {
    if (!dashboard) return;
    const previous = drawingHistory.current.past.pop();
    if (!previous) return;
    drawingHistory.current.future.push(dashboard.drawings ?? []);
    setDashboard(current => current ? { ...current, drawings: previous } : current);
  };

  const redoDrawing = () => {
    if (!dashboard) return;
    const next = drawingHistory.current.future.pop();
    if (!next) return;
    drawingHistory.current.past.push(dashboard.drawings ?? []);
    setDashboard(current => current ? { ...current, drawings: next } : current);
  };

  const clearDrawings = () => {
    if (!dashboard?.drawings?.length) return;
    drawingHistory.current.past.push(dashboard.drawings);
    drawingHistory.current.future = [];
    setDashboard(current => current ? { ...current, drawings: [] } : current);
  };

  const updateWidget = useCallback((id: string, updates: Partial<WidgetSpec>) =>
    setDashboard(p => p ? { ...p, widgets: p.widgets.map(w => w.id === id ? { ...w, ...updates } : w) } : p), []);

  const removeWidget  = useCallback((id: string) =>
    setDashboard(p => p ? { ...p, widgets: p.widgets.filter(w => w.id !== id) } : p), []);

  const duplicateWidget = useCallback((widget: WidgetSpec) => {
    const p = widget.position;
    setDashboard(d => d ? { ...d, widgets: [...d.widgets, { ...widget, id: `${widget.id}_d${Date.now()}`, position: { ...p, x: p.x + 1, y: p.y + 1 } }] } : d);
    setToast({ message: 'Duplicated', type: 'success' });
  }, []);

  /* ── DRAG: pixel ghost while moving, snap to grid on pointerup ── */
  const handleDragStart = useCallback((e: React.PointerEvent, widget: WidgetSpec) => {
    e.preventDefault();
    e.stopPropagation();
    // Capture position at drag start — never read from closure again
    const { x, y, w, h } = widget.position;
    const startPx = gridToPx(x, y, w, h);
    const mx0 = e.clientX;
    const my0 = e.clientY;

    setDraggingId(widget.id);
    setGhost({ id: widget.id, ...startPx });

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - mx0;
      const dy = ev.clientY - my0;
      setGhost({ id: widget.id, left: startPx.left + dx, top: startPx.top + dy, width: startPx.width, height: startPx.height });
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      const dx = ev.clientX - mx0;
      const dy = ev.clientY - my0;
      const newX = Math.max(0, Math.min(Math.round((startPx.left + dx) / CX), COLS - w));
      const newY = Math.max(0, Math.round((startPx.top  + dy) / RX));
      updateWidget(widget.id, { position: { x: newX, y: newY, w, h } });
      setGhost(null);
      setDraggingId(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [updateWidget]);

  /* ── RESIZE: pixel ghost while resizing, snap to grid on pointerup ── */
  const handleResizeStart = useCallback((e: React.PointerEvent, widget: WidgetSpec, edge: string) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y, w, h } = widget.position;
    const startPx = gridToPx(x, y, w, h);
    const mx0 = e.clientX;
    const my0 = e.clientY;

    setGhost({ id: widget.id, ...startPx });

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - mx0;
      const dy = ev.clientY - my0;
      const newW = edge.includes('right')  ? Math.max(CW, startPx.width  + dx) : startPx.width;
      const newH = edge.includes('bottom') ? Math.max(RH, startPx.height + dy) : startPx.height;
      setGhost({ id: widget.id, left: startPx.left, top: startPx.top, width: newW, height: newH });
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      const dx = ev.clientX - mx0;
      const dy = ev.clientY - my0;
      const newW = edge.includes('right')  ? Math.max(1, Math.min(COLS - x, Math.round((startPx.width  + dx + G) / CX))) : w;
      const newH = edge.includes('bottom') ? Math.max(1, Math.round((startPx.height + dy + G) / RX)) : h;
      updateWidget(widget.id, { position: { x, y, w: newW, h: newH } });
      setGhost(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [updateWidget]);

  const saveDashboard = async () => {
    if (!dashboard) return;
    setSaving(true);
    setAutosaveStatus('saving');
    try {
      await persistDashboard(dashboard);
      setAutosaveStatus('saved');
      setToast({ message: 'Saved', type: 'success' });
    } catch (e: any) {
      setAutosaveStatus('error');
      setToast({ message: e.message || 'Save failed', type: 'error' });
    }
    finally { setSaving(false); }
  };

  const handleRefresh = async () => {
    if (!dashboardId) return;
    setRefreshing(true);
    try {
      const refreshed = await fetchDashboard(dashboardId);
      persistedSnapshotRef.current = dashboardSaveSnapshot(refreshed);
      setDashboard(refreshed);
      setRefreshKey(key => key + 1);
      setToast({ message: 'Refreshed', type: 'success' });
    }
    catch (e: any) { setToast({ message: e.message || 'Refresh failed', type: 'error' }); }
    finally { setRefreshing(false); }
  };

  const handleDrillDown = async (widget: WidgetSpec, row: Record<string, any>) => {
    if (!dashboard) return;
    try {
      const nw = await fetchDrillDown(dashboard.id, widget.id, row);
      setDashboard(p => p ? { ...p, widgets: [...p.widgets, nw] } : p);
      setToast({ message: 'Drill-down added', type: 'success' });
    } catch (e: any) { setToast({ message: `Drill-down failed: ${e.message}`, type: 'error' }); }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setArtifacts(prev => [...prev, ...files.map(f => ({
      id: `a${Date.now()}${Math.random().toString(36).slice(2)}`,
      name: f.name, type: f.type.split('/')[1]?.toUpperCase() ?? 'FILE',
      size: f.size > 1048576 ? `${(f.size/1048576).toFixed(1)} MB` : `${(f.size/1024).toFixed(0)} KB`,
    }))]);
    e.target.value = '';
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex gap-3">
        {[0,1,2].map(i => <div key={i} className="h-40 w-64 animate-pulse rounded-xl" style={{ background: 'var(--bg-raised)', animationDelay: `${i*120}ms` }} />)}
      </div>
    </div>
  );

  if (!dashboard) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-base)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dashboard not found</p>
      <button onClick={() => navigate('/app/dashboard')} className="rounded-lg px-4 py-2 text-xs"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-muted)', color: 'var(--text-secondary)' }}>Go back</button>
    </div>
  );

  return (
    <div className="db-root">

      {/* ── Top bar ── */}
      <header className="db-header">
        <div className="flex items-center gap-2">
          <button className="db-icon-btn" onClick={() => navigate('/app/dashboard')} title="Back">{I.back}</button>
          <input value={dashboard.title} onChange={e => setDashboard(p => p ? { ...p, title: e.target.value } : p)}
            className="db-title-input" placeholder="Untitled Dashboard" />
          {isNew && <span className="db-badge-new">New</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="db-btn-ghost" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? I.spin : I.refresh}<span>Refresh</span>
          </button>
          <span className="db-autosave-status" data-state={autosaveStatus} role="status">
            {autosaveStatus === 'saving' ? 'Autosaving…' : autosaveStatus === 'pending' ? 'Unsaved changes' : autosaveStatus === 'error' ? 'Autosave failed' : 'All changes saved'}
          </span>
          <button className="db-btn-primary" onClick={saveDashboard} disabled={saving}>
            {saving ? I.spin : I.save}<span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="db-body">

        {/* ── Left panel ── */}
        <aside className="db-sidebar">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload}
            accept=".pdf,.pptx,.docx,.csv,.png,.jpg,.jpeg,.txt" />
          <div className="db-sidebar-section">
            <div className="db-sidebar-label">
              <span>Inputs</span>
              <button className="db-sidebar-add" onClick={() => fileInputRef.current?.click()}>{I.upload}</button>
            </div>
            {artifacts.length === 0 ? (
              <button className="db-upload-empty" onClick={() => fileInputRef.current?.click()}>
                {I.upload}<span>Upload files for AI</span>
              </button>
            ) : (
              <div className="space-y-1">
                {artifacts.map(a => (
                  <div key={a.id} className="db-artifact">
                    <span style={{ color: '#3b82f6' }}>{I.file}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.type} · {a.size}</p>
                    </div>
                    <button onClick={() => setArtifacts(p => p.filter(x => x.id !== a.id))} style={{ color: 'var(--text-muted)' }}>{I.close}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="db-sidebar-section">
            <div className="db-sidebar-label"><span>Outputs</span></div>
            {outputs.length === 0 ? (
              <div className="db-upload-empty" style={{ cursor: 'default' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                <span>AI outputs appear here</span>
              </div>
            ) : (
              <div className="space-y-1">
                {outputs.map(o => (
                  <div key={o.id} className="db-artifact">
                    <span style={{ color: '#10b981' }}>{I.file}</span>
                    <div className="min-w-0 flex-1">
                      <a href={`${API_BASE_URL}${o.url}`} download={o.name}
                        className="block truncate text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{o.name}</a>
                      <p className="text-[10px]" style={{ color: '#10b981' }}>Ready · {(o.size / 1048576).toFixed(1)} MB</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── Config drawer ── */}
        {editingWidget && (
          <ConfigDrawer widget={editingWidget} onClose={() => setEditingWidget(null)}
            onSave={cfg => { updateWidget(editingWidget.id, { title: cfg.title }); setToast({ message: 'Updated', type: 'success' }); }} />
        )}

        {/* ── Fullscreen ── */}
        {fullscreenWidget && (() => {
          const w = dashboard.widgets.find(w => w.id === fullscreenWidget);
          return (
            <div className="db-fullscreen-overlay" onClick={() => setFullscreenWidget(null)}>
              <div className="db-fullscreen-card" onClick={e => e.stopPropagation()}>
                <button className="db-fullscreen-close" onClick={() => setFullscreenWidget(null)}>{I.close}</button>
                {w && <WidgetRenderer widget={w} dashboardId={dashboard.id} refreshKey={refreshKey} />}
              </div>
            </div>
          );
        })()}

        {/* ── Canvas ── */}
        <main className={`db-canvas-scroll${draw.active ? ' drawing-active' : ''}`}>
          <div className="db-canvas-inner" style={{ width: canvasW, height: canvasH }}>
            {/* dot grid */}
            <svg className="db-dot-grid" width={canvasW} height={canvasH}>
              {Array.from({ length: Math.ceil(canvasH / RX) + 1 }, (_, r) =>
                Array.from({ length: Math.ceil(canvasW / CX) + 1 }, (_, c) => (
                  <circle key={`${r}-${c}`} cx={c * CX} cy={r * RX} r="1" fill="rgba(255,255,255,0.08)" />
                ))
              )}
            </svg>

            <canvas
              ref={canvasRef}
              className="db-doodle-canvas"
              style={{ pointerEvents: draw.active ? 'auto' : 'none', cursor: draw.active ? (draw.tool === 'eraser' ? 'cell' : 'crosshair') : 'default' }}
              onPointerDown={onDrawDown}
              onPointerMove={onDrawMove}
              onPointerUp={onDrawUp}
              onPointerCancel={onDrawUp}
            />

            {/* drag/resize ghost */}
            {ghost && (
              <div className="db-ghost" style={{ left: ghost.left, top: ghost.top, width: ghost.width, height: ghost.height }} />
            )}

            {/* widgets */}
            {dashboard.widgets.map(widget => {
              const pos = widget.position ?? { x: 0, y: 0, w: 4, h: 3 };
              const { left, top, width, height } = gridToPx(pos.x, pos.y, pos.w, pos.h);
              const isDragging = draggingId === widget.id;
              return (
                <div key={widget.id} className={`db-widget${isDragging ? ' dragging' : ''}`}
                  style={{ left, top, width, height }}>
                  <WidgetRenderer
                    widget={widget}
                    onDrillDown={widget.drill_down?.enabled ? handleDrillDown : undefined}
                    dashboardId={dashboard.id}
                    refreshKey={refreshKey}
                    actions={{
                      onEdit:       () => setEditingWidget(widget),
                      onDuplicate:  () => duplicateWidget(widget),
                      onFullscreen: () => setFullscreenWidget(widget.id),
                      onDelete:     () => removeWidget(widget.id),
                      onDragStart:  (e) => handleDragStart(e, widget),
                    }}
                  />
                  {/* resize handles */}
                  <div className="db-resize db-resize-r"  onPointerDown={e => handleResizeStart(e, widget, 'right')} />
                  <div className="db-resize db-resize-b"  onPointerDown={e => handleResizeStart(e, widget, 'bottom')} />
                  <div className="db-resize db-resize-br" onPointerDown={e => handleResizeStart(e, widget, 'right bottom')} />
                </div>
              );
            })}
          </div>
        </main>

        {/* ── Bottom toolbar ── */}
        <div className="db-bottom-bar" style={{ bottom: `${consoleHeight + 12}px` }}>
          <button className="db-bottom-btn" onClick={() => setChatOpen(true)} title="Ask the agent to create a widget">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Ask agent
          </button>
          <div className="db-bottom-sep" />
          <button className={`db-bottom-btn${draw.active ? ' active' : ''}`} onClick={() => setDraw(p => ({ ...p, active: !p.active }))}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
            Doodle {draw.active && <span className="db-bottom-badge">ON</span>}
          </button>
          {draw.active && (<>
            <div className="db-bottom-sep" />
            <button className="db-bottom-tool" onClick={undoDrawing} disabled={!drawingHistory.current.past.length} title="Undo drawing (Ctrl+Z)" aria-label="Undo drawing">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6L3 13"/></svg>
            </button>
            <button className="db-bottom-tool" onClick={redoDrawing} disabled={!drawingHistory.current.future.length} title="Redo drawing (Ctrl+Shift+Z)" aria-label="Redo drawing">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0115-6l3 2"/></svg>
            </button>
            <button className="db-bottom-tool" onClick={clearDrawings} disabled={!dashboard.drawings?.length} title="Clear drawings" aria-label="Clear drawings">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2m3 0-1 14H6L5 6"/><path d="M10 11v5m4-5v5"/></svg>
            </button>
            <div className="db-bottom-sep" />
            {(['pen','brush','marker','eraser'] as const).map(t => (
              <button key={t} className={`db-bottom-tool${draw.tool === t ? ' active' : ''}`} onClick={() => setDraw(p => ({ ...p, tool: t }))} title={t}>
                {t === 'pen'    && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>}
                {t === 'brush'  && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 15l-3-3-9 9a2.828 2.828 0 104-4l9-9z"/><path d="M15 12l3-3 3 3-3 3z"/></svg>}
                {t === 'marker' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 11l-8-8-8.5 8.5a2.12 2.12 0 000 3l3 3a2.12 2.12 0 003 0L19 11z"/><path d="M13 7l4 4"/></svg>}
                {t === 'eraser' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z"/><path d="M17 17L7 7"/></svg>}
              </button>
            ))}
            <div className="db-bottom-sep" />
            <div className="db-color-swatch" style={{ background: draw.color }}>
              <input type="color" value={draw.color} onChange={e => setDraw(p => ({ ...p, color: e.target.value }))} className="db-color-input" />
            </div>
            <div className="db-bottom-sep" />
            <input type="range" min="1" max="40" value={draw.size} onChange={e => setDraw(p => ({ ...p, size: +e.target.value }))}
              className="db-size-slider" title={`Size: ${draw.size}`} />
            <span className="db-size-label">{draw.size}</span>
          </>)}
        </div>

        {/* ── Floating chat ── */}
        <div className="db-chat-fab" style={{ bottom: `${consoleHeight + 12}px` }}>
          {chatOpen && (
            <div className="db-chat-panel">
              <div className="db-chat-header">
                <div className="flex items-center gap-2">
                  <div className="db-chat-avatar">{I.agent}</div>
                  <span>Agent</span>
                </div>
                <select
                  aria-label="Agent fleet for this chat"
                  className="db-chat-fleet-select"
                  value={selectedFleetId}
                  onChange={(event) => setSelectedFleetId(event.target.value)}
                >
                  {agentFleets.map((fleet) => <option key={fleet.id} value={fleet.id}>{fleet.name}</option>)}
                </select>
                <button onClick={() => setChatOpen(false)}>{I.close}</button>
              </div>
              <div className="db-chat-sources">
                <label htmlFor="db-agent-source" className="db-chat-source-label">Dashboard data sources</label>
                <select
                  id="db-agent-source"
                  className="db-chat-source-select"
                  value=""
                  onChange={(event) => {
                    const source = availableSources.find((item) => item.id === event.target.value);
                    if (source) setSelectedSources((current) => ({ ...current, [source.id]: source.tables ?? [] }));
                  }}
                >
                  <option value="">Add a SQL source</option>
                  {availableSources.filter((source) => source.sourceType === 'remote_sql').map((source) => (
                    <option key={source.id} value={source.id} disabled={Object.prototype.hasOwnProperty.call(selectedSources, source.id)}>{source.name}</option>
                  ))}
                </select>
                <div className="db-chat-selected-sources">
                  {Object.entries(selectedSources).map(([schemaId, tables]) => {
                    const source = availableSources.find((item) => item.id === schemaId);
                    if (!source) return null;
                    return (
                      <div key={schemaId} className="db-chat-selected-source">
                        <div className="db-chat-selected-source-heading">
                          <span>{source.name}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedSources((current) => {
                              const next = { ...current };
                              delete next[schemaId];
                              return next;
                            })}
                            aria-label={`Remove ${source.name}`}
                          >{I.close}</button>
                        </div>
                        {source.tables?.length ? (
                          <div className="db-chat-tables">
                            {source.tables.map((table) => (
                              <label key={table}>
                                <input
                                  type="checkbox"
                                  checked={tables.includes(table)}
                                  onChange={(event) => setSelectedSources((current) => ({
                                    ...current,
                                    [schemaId]: event.target.checked
                                      ? [...(current[schemaId] ?? []), table]
                                      : (current[schemaId] ?? []).filter((selectedTable) => selectedTable !== table),
                                  }))}
                                />
                                <span>{table}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <span className="db-chat-no-tables">No tables available</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="db-chat-body">
                <ChatPanel messages={messages} sending={sending} onSend={sendMessage} onStop={stopMessage} />
              </div>
            </div>
          )}
          <button className="db-chat-btn" onClick={() => setChatOpen(v => !v)} title="Open agent chat">
            {chatOpen ? I.close : I.chat}
          </button>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>

      <style>{`
        .db-root { display:flex; flex-direction:column; height:100vh; background:var(--bg-base); overflow:hidden; }

        /* header */
        .db-header { display:flex; align-items:center; justify-content:space-between; height:52px; padding:0 16px; flex-shrink:0; background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); gap:12px; }
        .db-icon-btn { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; background:var(--bg-raised); border:1px solid var(--border-subtle); color:var(--text-secondary); cursor:pointer; transition:all .15s; }
        .db-icon-btn:hover { color:var(--text-primary); border-color:var(--border-muted); }
        .db-title-input { background:transparent; border:none; outline:none; font-size:14px; font-weight:600; color:var(--text-primary); min-width:140px; max-width:260px; }
        .db-badge-new { font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.25); color:#3b82f6; }
        .db-btn-ghost { display:flex; align-items:center; gap:6px; height:32px; padding:0 12px; border-radius:8px; background:var(--bg-raised); border:1px solid var(--border-subtle); color:var(--text-secondary); font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; }
        .db-btn-ghost:hover { color:var(--text-primary); }
        .db-btn-ghost:disabled { opacity:.4; cursor:not-allowed; }
        .db-btn-primary { display:flex; align-items:center; gap:6px; height:32px; padding:0 16px; border-radius:8px; background:linear-gradient(135deg,#3b82f6,#06b6d4); border:none; color:#fff; font-size:12px; font-weight:600; cursor:pointer; box-shadow:0 0 16px rgba(59,130,246,0.25); transition:opacity .15s; }
        .db-btn-primary:hover { opacity:.9; }
        .db-btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        .db-autosave-status { min-width:104px; color:var(--text-muted); font-size:10px; text-align:right; white-space:nowrap; }
        .db-autosave-status[data-state="error"] { color:#f87171; }

        /* body */
        .db-body { display:flex; flex:1; overflow:hidden; position:relative; }

        /* sidebar */
        .db-sidebar { width:200px; flex-shrink:0; background:var(--bg-surface); border-right:1px solid var(--border-subtle); overflow-y:auto; display:flex; flex-direction:column; }
        .db-sidebar-section { padding:12px 10px; border-bottom:1px solid var(--border-subtle); }
        .db-sidebar-label { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--text-muted); }
        .db-sidebar-add { display:flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:4px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); color:#3b82f6; cursor:pointer; }
        .db-upload-empty { display:flex; flex-direction:column; align-items:center; gap:6px; width:100%; padding:16px 8px; border:1px dashed var(--border-subtle); border-radius:8px; color:var(--text-muted); font-size:10px; cursor:pointer; transition:all .15s; background:transparent; }
        .db-upload-empty:hover { border-color:rgba(59,130,246,0.4); color:#3b82f6; }
        .db-artifact { display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:8px; background:var(--bg-raised); border:1px solid var(--border-subtle); }

        /* canvas */
        .db-canvas-scroll { flex:1; overflow:auto; position:relative; background:var(--bg-base); }
        .db-canvas-scroll.drawing-active .db-widget { pointer-events:none; }
        .db-canvas-inner { position:relative; margin:24px; }
        .db-dot-grid { position:absolute; inset:0; pointer-events:none; }
        .db-doodle-canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; z-index:1; }
        .db-ghost { position:absolute; border:2px dashed rgba(59,130,246,0.55); background:rgba(59,130,246,0.07); border-radius:8px; pointer-events:none; z-index:200; transition: none; }
        /* widget tile on canvas */
        .db-widget { position:absolute; z-index:2; }
        .db-widget.dragging { opacity:.4; pointer-events:none; }

        /* resize handles */
        .db-resize { position:absolute; z-index:30; background:transparent; }
        .db-resize:hover { background:rgba(59,130,246,0.3); border-radius:3px; }
        .db-resize-r  { right:-5px; top:16px; bottom:16px; width:10px; cursor:ew-resize; }
        .db-resize-b  { bottom:-5px; left:16px; right:16px; height:10px; cursor:ns-resize; }
        .db-resize-br { right:-5px; bottom:-5px; width:14px; height:14px; cursor:nwse-resize; border-radius:3px; }

        /* bottom toolbar */
        .db-bottom-bar { position:absolute; bottom:20px; left:50%; transform:translateX(-50%); z-index:40; display:flex; align-items:center; gap:2px; padding:5px 8px; border-radius:14px; background:var(--bg-surface); border:1px solid var(--border-subtle); box-shadow:0 8px 32px rgba(0,0,0,0.4); backdrop-filter:blur(12px); }
        .db-bottom-btn { display:flex; align-items:center; gap:5px; padding:5px 10px; border-radius:9px; border:none; background:transparent; color:var(--text-secondary); font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; white-space:nowrap; }
        .db-bottom-btn:hover { background:var(--bg-raised); color:var(--text-primary); }
        .db-bottom-btn.active { background:rgba(59,130,246,0.15); color:#3b82f6; }
        .db-bottom-badge { font-size:9px; font-weight:700; padding:1px 5px; border-radius:999px; background:#3b82f6; color:#fff; }
        .db-bottom-sep { width:1px; height:18px; background:var(--border-subtle); margin:0 2px; }
        .db-bottom-tool { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; border:none; background:transparent; color:var(--text-secondary); cursor:pointer; transition:all .15s; }
        .db-bottom-tool:hover { background:var(--bg-raised); color:var(--text-primary); }
        .db-bottom-tool.active { background:rgba(59,130,246,0.15); color:#3b82f6; }
        .db-bottom-tool:disabled { opacity:.35; cursor:not-allowed; }
        .db-color-swatch { position:relative; width:22px; height:22px; border-radius:50%; border:2px solid rgba(255,255,255,0.2); cursor:pointer; overflow:hidden; flex-shrink:0; }
        .db-color-input { position:absolute; inset:-4px; opacity:0; cursor:pointer; width:calc(100%+8px); height:calc(100%+8px); }
        .db-size-slider { width:60px; accent-color:#3b82f6; cursor:pointer; }
        .db-size-label { font-size:10px; color:var(--text-muted); min-width:16px; text-align:right; }

        /* fullscreen */
        .db-fullscreen-overlay { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:32px; }
        .db-fullscreen-card { position:relative; width:100%; max-width:1100px; height:100%; border-radius:16px; background:var(--bg-surface); border:1px solid var(--border-subtle); overflow:hidden; }
        .db-fullscreen-close { position:absolute; right:12px; top:12px; z-index:10; display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:8px; background:var(--bg-raised); border:1px solid var(--border-subtle); color:var(--text-secondary); cursor:pointer; }

        /* chat */
        .db-chat-fab { position:fixed; bottom:24px; right:24px; z-index:50; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
        .db-chat-panel { width:360px; height:520px; border-radius:20px; overflow:hidden; background:var(--bg-surface); border:1px solid var(--border-subtle); box-shadow:0 20px 60px rgba(0,0,0,0.5); display:flex; flex-direction:column; }
        .db-chat-header { display:flex; align-items:center; justify-content:space-between; padding:0 14px; height:48px; border-bottom:1px solid var(--border-subtle); font-size:13px; font-weight:600; color:var(--text-primary); flex-shrink:0; }
        .db-chat-fleet-select { min-width:0; max-width:46%; height:30px; padding:0 8px; border:1px solid var(--border-subtle); border-radius:6px; background:var(--bg-raised); color:var(--text-secondary); font-size:11px; font-weight:500; }
        .db-chat-sources { padding:8px 12px; border-bottom:1px solid var(--border-subtle); flex-shrink:0; }
        .db-chat-source-label { display:block; margin-bottom:5px; font-size:10px; color:var(--text-muted); }
        .db-chat-source-select { width:100%; min-height:28px; padding:4px 8px; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-raised); color:var(--text-secondary); font-size:11px; }
        .db-chat-selected-sources { display:flex; flex-direction:column; gap:5px; max-height:148px; margin-top:5px; overflow-y:auto; }
        .db-chat-selected-source { padding:5px 7px; border:1px solid var(--border-subtle); border-radius:6px; color:var(--text-secondary); font-size:10px; }
        .db-chat-selected-source-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; font-weight:600; }
        .db-chat-selected-source-heading button { display:flex; align-items:center; justify-content:center; width:18px; height:18px; color:var(--text-muted); }
        .db-chat-tables { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:3px 8px; margin-top:4px; }
        .db-chat-tables label { display:flex; min-width:0; align-items:center; gap:5px; color:var(--text-muted); }
        .db-chat-tables input { flex-shrink:0; accent-color:var(--accent); }
        .db-chat-tables span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .db-chat-no-tables { display:block; margin-top:3px; color:var(--text-muted); }
        .db-chat-avatar { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; background:rgba(59,130,246,0.12); color:#3b82f6; }
        .db-chat-body { flex:1; min-height:0; }
        .db-chat-btn { display:flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:50%; background:linear-gradient(135deg,#3b82f6,#06b6d4); color:#fff; border:none; cursor:pointer; box-shadow:0 0 24px rgba(59,130,246,0.4); transition:transform .15s; }
        .db-chat-btn:hover { transform:scale(1.06); }
        .db-chat-btn:active { transform:scale(.95); }

        @media (max-width: 760px) {
          .db-header { height:auto; min-height:52px; padding:8px; flex-wrap:wrap; }
          .db-title-input { min-width:0; width:min(42vw,220px); }
          .db-btn-ghost, .db-btn-primary { height:30px; padding:0 8px; font-size:11px; }
          .db-sidebar { display:none; }
          .db-canvas-inner { margin:12px; }
          .db-bottom-bar { left:8px; right:8px; bottom:8px; max-width:calc(100vw - 16px); transform:none; overflow-x:auto; justify-content:flex-start; }
          .db-chat-fab { right:12px; bottom:58px; }
          .db-chat-panel { width:min(360px, calc(100vw - 24px)); height:min(520px, calc(100dvh - 130px)); }
          .db-fullscreen-overlay { padding:10px; }
          .db-fullscreen-card { border-radius:8px; }
        }
      `}</style>
    </div>
  );
}
