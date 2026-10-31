import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Activity,
  Cpu,
  Share2,
  Atom,
  Info,
  MapPin,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  BoundingBox,
  CLUSTER_PALETTE,
  CPK_ATOM_COLORS,
  GraphEdge,
  SpatialPoint,
  SpatialTile,
  SpatialTileIndex,
  ViewportTransform,
} from '@/lib/spatialTiling';

export type TilingMode = 'clusters' | 'graph' | 'map' | 'molecular';

interface Props {
  points: SpatialPoint[];
  edges?: GraphEdge[];
  mode?: TilingMode;
  title?: string;
  height?: number | string;
  onPointClick?: (point: SpatialPoint) => void;
  onTileClick?: (tile: SpatialTile) => void;
  showTileGrid?: boolean;
}

export default function TiledVisualizer({
  points,
  edges = [],
  mode = 'clusters',
  title,
  height = '100%',
  onPointClick,
  onTileClick,
  showTileGrid: initialShowTileGrid = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport transformation state
  const [transform, setTransform] = useState<ViewportTransform>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
    viewWidth: 600,
    viewHeight: 400,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<SpatialPoint | null>(null);
  const [hoveredTile, setHoveredTile] = useState<SpatialTile | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(initialShowTileGrid);
  const [activeMode, setActiveMode] = useState<TilingMode>(mode);

  // Telemetry HUD state
  const [telemetry, setTelemetry] = useState<{
    visibleTiles: number;
    totalTiles: number;
    renderedElements: number;
    culledElements: number;
    zoomLevel: number;
  }>({
    visibleTiles: 0,
    totalTiles: 0,
    renderedElements: 0,
    culledElements: 0,
    zoomLevel: 0,
  });

  // Construct spatial tile index
  const tileIndex = useMemo(() => {
    return new SpatialTileIndex(points, 5);
  }, [points]);

  // Handle ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setTransform((prev) => ({
            ...prev,
            viewWidth: width,
            viewHeight: height,
          }));
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Reset view to fit
  const handleResetView = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      zoom: 1.0,
      panX: 0,
      panY: 0,
    }));
  }, []);

  // Zoom buttons
  const handleZoomIn = () => {
    setTransform((prev) => ({ ...prev, zoom: Math.min(prev.zoom * 1.4, 25.0) }));
  };

  const handleZoomOut = () => {
    setTransform((prev) => ({ ...prev, zoom: Math.max(prev.zoom / 1.4, 0.5) }));
  };

  // Wheel zoom around cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.83;
    setTransform((prev) => {
      const newZoom = Math.max(0.5, Math.min(prev.zoom * zoomFactor, 30.0));
      // Adjust pan to zoom into mouse cursor
      const scaleChange = newZoom / prev.zoom;
      const originX = prev.viewWidth / 2 + prev.panX;
      const originY = prev.viewHeight / 2 + prev.panY;

      const newPanX = mouseX - (mouseX - originX) * scaleChange - prev.viewWidth / 2;
      const newPanY = mouseY - (mouseY - originY) * scaleChange - prev.viewHeight / 2;

      return {
        ...prev,
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      };
    });
  };

  // Mouse drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.panX, y: e.clientY - transform.panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        panX: e.clientX - dragStart.x,
        panY: e.clientY - dragStart.y,
      }));
      setHoveredPoint(null);
      setTooltipPos(null);
      return;
    }

    // Hit-testing points in visible world
    const worldPos = tileIndex.screenToWorld(mouseX, mouseY, transform);
    const visibleBounds = tileIndex.getVisibleBounds(transform);
    const { tiles } = tileIndex.queryViewport(visibleBounds, Math.log2(transform.zoom) + 1);

    // Find closest point within threshold
    const hitRadiusWorld = 12 / (transform.zoom * 20);
    let closestPt: SpatialPoint | null = null;
    let closestDist = Infinity;

    for (const tile of tiles) {
      for (const pt of tile.items) {
        const d = Math.hypot(pt.x - worldPos.x, pt.y - worldPos.y);
        if (d < hitRadiusWorld && d < closestDist) {
          closestDist = d;
          closestPt = pt;
        }
      }
    }

    if (closestPt) {
      setHoveredPoint(closestPt);
      setTooltipPos({ x: mouseX, y: mouseY });
    } else {
      setHoveredPoint(null);
      setTooltipPos(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hoveredPoint && onPointClick) {
      onPointClick(hoveredPoint);
    } else if (hoveredTile && onTileClick) {
      onTileClick(hoveredTile);
    }
  };

  // ── High-Performance Canvas Rendering Loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina display DPR support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = transform.viewWidth * dpr;
    canvas.height = transform.viewHeight * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#070811';
    ctx.fillRect(0, 0, transform.viewWidth, transform.viewHeight);

    // 1. Calculate visible bounds and query tiles
    const targetZoomLevel = Math.max(0, Math.min(5, Math.floor(Math.log2(transform.zoom * 1.5))));
    const visibleBounds = tileIndex.getVisibleBounds(transform);
    const { tiles, zoomLevel, totalPointsCulled, totalPointsVisible } = tileIndex.queryViewport(
      visibleBounds,
      targetZoomLevel
    );

    // Update telemetry
    setTelemetry({
      visibleTiles: tiles.length,
      totalTiles: Math.pow(2, zoomLevel) * Math.pow(2, zoomLevel),
      renderedElements: totalPointsVisible,
      culledElements: totalPointsCulled,
      zoomLevel,
    });

    const isHighZoom = transform.zoom >= 2.8;

    // 2. Render Tile Grid & Density Heatmaps
    for (const tile of tiles) {
      const p1 = tileIndex.worldToScreen(tile.bounds.minX, tile.bounds.maxY, transform);
      const p2 = tileIndex.worldToScreen(tile.bounds.maxX, tile.bounds.minY, transform);
      const tileWidthPx = p2.x - p1.x;
      const tileHeightPx = p2.y - p1.y;

      // Draw subtle tile background heatmap
      if (!isHighZoom && tile.density > 0) {
        const grad = ctx.createRadialGradient(
          (p1.x + p2.x) / 2,
          (p1.y + p2.y) / 2,
          0,
          (p1.x + p2.x) / 2,
          (p1.y + p2.y) / 2,
          tileWidthPx * 0.6
        );

        const colorHue = activeMode === 'molecular' ? '180' : activeMode === 'graph' ? '260' : '200';
        grad.addColorStop(0, `hsla(${colorHue}, 90%, 50%, ${tile.density * 0.35})`);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.fillRect(p1.x - 20, p1.y - 20, tileWidthPx + 40, tileHeightPx + 40);
      }

      // Draw tile grid border lines
      if (showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(p1.x, p1.y, tileWidthPx, tileHeightPx);

        // Tile ID label on corner
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '9px monospace';
        ctx.fillText(`T[${tile.z}:${tile.x},${tile.y}]`, p1.x + 4, p1.y + 12);
      }
    }

    // 3. Render Graph Edges (if in graph mode)
    if (activeMode === 'graph' && edges.length > 0) {
      const nodeMap = new Map<string | number, SpatialPoint>();
      for (const tile of tiles) {
        for (const pt of tile.items) {
          if (pt.id !== undefined) nodeMap.set(pt.id, pt);
        }
      }

      ctx.lineWidth = isHighZoom ? 1.2 : 0.6;
      ctx.strokeStyle = isHighZoom ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.15)';

      for (const edge of edges) {
        const n1 = nodeMap.get(edge.source);
        const n2 = nodeMap.get(edge.target);
        if (n1 && n2) {
          const s1 = tileIndex.worldToScreen(n1.x, n1.y, transform);
          const s2 = tileIndex.worldToScreen(n2.x, n2.y, transform);

          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
        }
      }
    }

    // 4. Render Molecular Bonds (if in molecular mode)
    if (activeMode === 'molecular' && isHighZoom) {
      // Connect sequential or proximate atoms in same tile as covalent bonds
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = Math.max(1, 2 * (transform.zoom / 5));

      for (const tile of tiles) {
        const sortedAtoms = tile.items;
        for (let i = 0; i < sortedAtoms.length - 1; i++) {
          const a1 = sortedAtoms[i];
          const a2 = sortedAtoms[i + 1];
          const dist = Math.hypot(a1.x - a2.x, a1.y - a2.y);
          if (dist < 3.0) {
            const s1 = tileIndex.worldToScreen(a1.x, a1.y, transform);
            const s2 = tileIndex.worldToScreen(a2.x, a2.y, transform);
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();
          }
        }
      }
    }

    // 5. Render Level-of-Detail Elements
    if (!isHighZoom) {
      // ── LOW / MEDIUM ZOOM: Render Aggregate Tile Super-Nodes ──
      for (const tile of tiles) {
        if (tile.count === 0) continue;
        const screenCentroid = tileIndex.worldToScreen(tile.centroid.x, tile.centroid.y, transform);

        // Size scaled by count & density
        const baseRadius = Math.max(8, Math.min(32, 8 + Math.sqrt(tile.count) * 2));
        const color =
          activeMode === 'molecular'
            ? '#06b6d4'
            : activeMode === 'graph'
            ? '#8b5cf6'
            : CLUSTER_PALETTE[tile.x % CLUSTER_PALETTE.length];

        // Outer glow
        ctx.beginPath();
        ctx.arc(screenCentroid.x, screenCentroid.y, baseRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${color}25`;
        ctx.fill();

        // Inner circle
        ctx.beginPath();
        ctx.arc(screenCentroid.x, screenCentroid.y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Count label inside
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const formattedCount = tile.count >= 1000 ? `${(tile.count / 1000).toFixed(1)}k` : String(tile.count);
        ctx.fillText(formattedCount, screenCentroid.x, screenCentroid.y);

        // Category subtitle
        if (tile.dominantCategory) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = '9px Inter, sans-serif';
          ctx.fillText(tile.dominantCategory, screenCentroid.x, screenCentroid.y + baseRadius + 10);
        }
      }
    } else {
      // ── HIGH ZOOM: Render Individual Points, Atoms & Nodes with Full Detail ──
      for (const tile of tiles) {
        for (const pt of tile.items) {
          const s = tileIndex.worldToScreen(pt.x, pt.y, transform);

          // Culling check against screen bounds
          if (s.x < -20 || s.x > transform.viewWidth + 20 || s.y < -20 || s.y > transform.viewHeight + 20) {
            continue;
          }

          let ptColor = pt.color;
          if (!ptColor) {
            if (activeMode === 'molecular') {
              const atomType = String(pt.label || pt.category || 'C').toUpperCase();
              ptColor = CPK_ATOM_COLORS[atomType] || CPK_ATOM_COLORS.DEFAULT;
            } else {
              ptColor = CLUSTER_PALETTE[(Number(pt.id) || 0) % CLUSTER_PALETTE.length] || '#06b6d4';
            }
          }

          const radius = pt.radius || (activeMode === 'molecular' ? 5 : 3.5);
          const isHovered = hoveredPoint && hoveredPoint.id === pt.id;

          ctx.beginPath();
          ctx.arc(s.x, s.y, isHovered ? radius + 3 : radius, 0, Math.PI * 2);
          ctx.fillStyle = isHovered ? '#ffffff' : ptColor;
          ctx.fill();

          if (isHovered || activeMode === 'molecular') {
            ctx.strokeStyle = isHovered ? '#06b6d4' : 'rgba(255,255,255,0.4)';
            ctx.lineWidth = isHovered ? 2 : 1;
            ctx.stroke();
          }

          // In high zoom, render atom / node label
          if (transform.zoom >= 6.0 && pt.label) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(pt.label, s.x, s.y - radius - 3);
          }
        }
      }
    }
  }, [transform, tileIndex, showGrid, activeMode, edges, hoveredPoint]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[360px] rounded-2xl overflow-hidden border border-white/10 bg-[#070811] shadow-2xl select-none"
      style={{ height }}
    >
      {/* ── Canvas Layer ── */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* ── Top Bar Overlay (Title & Mode Switcher) ── */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {title && (
            <div className="rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
              <span className="text-xs font-bold text-white tracking-wide">{title}</span>
            </div>
          )}

          {/* Mode Selector Pill */}
          <div className="flex items-center rounded-xl border border-white/10 bg-black/60 p-1 backdrop-blur-md">
            {[
              { id: 'clusters', label: 'Clusters', icon: Activity },
              { id: 'graph', label: 'Graph', icon: Share2 },
              { id: 'map', label: 'Map Tile', icon: MapPin },
              { id: 'molecular', label: 'Molecular', icon: Atom },
            ].map((m) => {
              const Icon = m.icon;
              const active = activeMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMode(m.id as TilingMode)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 p-1 backdrop-blur-md pointer-events-auto">
          <button
            onClick={() => setShowGrid((g) => !g)}
            title="Toggle Spatial Grid Tiles"
            className={`rounded-lg p-1.5 transition-colors ${
              showGrid ? 'text-cyan-400 bg-white/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleResetView}
            title="Fit to Screen"
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Bottom Telemetry HUD Overlay ── */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] font-mono text-slate-300 backdrop-blur-md pointer-events-auto">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>LoD Level: <strong className="text-cyan-400">{telemetry.zoomLevel}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Zoom: <strong className="text-white">{transform.zoom.toFixed(1)}x</strong></span>
          <span className="text-slate-600">|</span>
          <span>Visible Tiles: <strong className="text-indigo-400">{telemetry.visibleTiles}</strong></span>
          <span className="text-slate-600">|</span>
          <span>
            Elements: <strong className="text-emerald-400">{telemetry.renderedElements.toLocaleString()}</strong>
            <span className="text-slate-500"> ({telemetry.culledElements.toLocaleString()} culled)</span>
          </span>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-medium text-slate-400 backdrop-blur-md">
          {transform.zoom >= 2.8 ? 'Atomic / Node Resolution' : 'Aggregated Tile Envelopes'}
        </div>
      </div>

      {/* ── Hover Tooltip Overlay ── */}
      {hoveredPoint && tooltipPos && (
        <div
          className="absolute z-20 pointer-events-none rounded-xl border border-cyan-500/40 bg-slate-900/90 p-2.5 shadow-2xl backdrop-blur-md text-xs text-white"
          style={{
            left: Math.min(tooltipPos.x + 12, transform.viewWidth - 180),
            top: Math.min(tooltipPos.y + 12, transform.viewHeight - 100),
          }}
        >
          <div className="font-bold text-cyan-300 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>{hoveredPoint.label || `Entity #${hoveredPoint.id}`}</span>
          </div>
          {hoveredPoint.category && (
            <div className="text-[10px] text-slate-400 mt-0.5">Category: {hoveredPoint.category}</div>
          )}
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            X: {hoveredPoint.x.toFixed(2)} · Y: {hoveredPoint.y.toFixed(2)}
          </div>
          {hoveredPoint.metadata && (
            <div className="mt-1 pt-1 border-t border-white/10 text-[9px] text-slate-300">
              {Object.entries(hoveredPoint.metadata).slice(0, 3).map(([k, v]) => (
                <div key={k}>{k}: {String(v)}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

