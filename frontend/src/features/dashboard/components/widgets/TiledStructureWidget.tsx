import React, { useMemo, useState } from 'react';
import WidgetCard from './WidgetCard';
import TiledVisualizer, { TilingMode } from '@/components/tiling/TiledVisualizer';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import type { GraphEdge, SpatialPoint } from '@/lib/spatialTiling';

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
  actions?: WidgetActions;
}

export default function TiledStructureWidget({ widget, onRowClick, actions }: Props) {
  const rows = Array.isArray(widget.data) ? widget.data : [];

  // Parse mode from widget properties
  const detectedMode: TilingMode = useMemo(() => {
    const titleLower = widget.title.toLowerCase();
    if (titleLower.includes('molecule') || titleLower.includes('protein') || titleLower.includes('pdb') || titleLower.includes('atom')) {
      return 'molecular';
    }
    if (titleLower.includes('graph') || titleLower.includes('network') || titleLower.includes('interactome')) {
      return 'graph';
    }
    if (titleLower.includes('map') || titleLower.includes('geo') || widget.gis) {
      return 'map';
    }
    return 'clusters';
  }, [widget.title, widget.gis]);

  const [activeMode, setActiveMode] = useState<TilingMode>(detectedMode);

  // Convert raw rows to SpatialPoints
  const { points, edges } = useMemo(() => {
    if (rows.length > 0) {
      const sample = rows[0];
      const keys = Object.keys(sample);

      // Find x and y
      const xKey = widget.x_field || keys.find((k) => ['x', 'umap_1', 'pca_1', 'tsne_1', 'lng', 'lon', 'coord_x'].includes(k.toLowerCase())) || keys[0];
      const yKey = (Array.isArray(widget.y_field) ? widget.y_field[0] : widget.y_field) ||
        keys.find((k) => ['y', 'umap_2', 'pca_2', 'tsne_2', 'lat', 'coord_y'].includes(k.toLowerCase())) || keys[1];

      const pts: SpatialPoint[] = [];
      const edg: GraphEdge[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const x = Number(r[xKey]);
        const y = Number(r[yKey]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        const id = r.id || r.atom_id || r.node_id || i;
        const label = r.label || r.name || r.atom_name || r.gene || String(id);
        const cat = r.category || r.cluster || r.cell_type || r.element || r.type || 'Cluster A';

        pts.push({
          id,
          x,
          y,
          label: String(label),
          category: String(cat),
          metadata: r,
        });

        // If edge list present in row
        if (r.target_id !== undefined || r.target !== undefined) {
          edg.push({
            source: id,
            target: r.target_id || r.target,
            weight: Number(r.weight) || 1,
          });
        }
      }

      if (pts.length > 0) {
        return { points: pts, edges: edg };
      }
    }

    // Benchmark synthetic structure generator if data is empty
    return generateBenchmarkData(activeMode);
  }, [rows, widget.x_field, widget.y_field, activeMode]);

  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="flex flex-col h-full w-full gap-2">
        {/* Metric info bar */}
        <div className="widget-metrics-strip">
          <div className="widget-metric-chip">
            <span className="widget-metric-label">Structure Type</span>
            <span className="widget-metric-val capitalize">{activeMode}</span>
          </div>
          <div className="widget-metric-chip">
            <span className="widget-metric-label">Tiled Elements</span>
            <span className="widget-metric-val">{points.length.toLocaleString()}</span>
          </div>
          {edges.length > 0 && (
            <div className="widget-metric-chip">
              <span className="widget-metric-label">Corridor Edges</span>
              <span className="widget-metric-val">{edges.length.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-[300px] w-full rounded-xl overflow-hidden border border-white/10 relative">
          <TiledVisualizer
            points={points}
            edges={edges}
            mode={activeMode}
            onPointClick={(pt) => {
              if (onRowClick && pt.metadata) {
                onRowClick(pt.metadata);
              }
            }}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

/**
 * Generates synthetic high-dimensional multi-cluster, graph, or molecular structure.
 */
function generateBenchmarkData(mode: TilingMode): { points: SpatialPoint[]; edges: GraphEdge[] } {
  const points: SpatialPoint[] = [];
  const edges: GraphEdge[] = [];

  if (mode === 'molecular') {
    // Generate Macromolecular Ribbon / Alpha-Helix Atomic Lattice
    const numResidues = 120;
    let atomId = 1;
    const elements = ['C', 'N', 'O', 'C', 'CA'];

    for (let r = 0; r < numResidues; r++) {
      const angle = (r / 3.6) * 2 * Math.PI; // Alpha-helix pitch
      const radius = 2.5 + (Math.sin(r / 8.0) * 0.5);
      const zHelix = r * 0.9;
      const xBase = Math.cos(angle) * radius;
      const yBase = Math.sin(angle) * radius + zHelix * 0.3;

      for (let j = 0; j < 3; j++) {
        const el = elements[(r + j) % elements.length];
        const offsetAngle = angle + (j * 0.4);
        const x = xBase + Math.cos(offsetAngle) * 0.8;
        const y = yBase + Math.sin(offsetAngle) * 0.8;

        points.push({
          id: atomId++,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          label: `${el}${atomId}`,
          category: el,
          radius: el === 'C' ? 4 : el === 'O' ? 5 : 4.5,
          metadata: { residue: `GLY_${r + 1}`, atom: el, index: atomId },
        });
      }
    }
  } else if (mode === 'graph') {
    // Generate scale-free biological network
    const numNodes = 180;
    const numClusters = 5;
    const centers = [
      { x: -12, y: -8, cat: 'Metabolic Core' },
      { x: 14, y: -10, cat: 'Signal Transduction' },
      { x: 0, y: 15, cat: 'Transcriptional Hub' },
      { x: -15, y: 12, cat: 'Kinase Cascade' },
      { x: 16, y: 14, cat: 'Ion Channel Complex' },
    ];

    for (let i = 0; i < numNodes; i++) {
      const cIdx = i % numClusters;
      const center = centers[cIdx];
      const r = Math.sqrt(Math.random()) * 6.5;
      const theta = Math.random() * 2 * Math.PI;
      const x = center.x + Math.cos(theta) * r;
      const y = center.y + Math.sin(theta) * r;

      points.push({
        id: i + 1,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        label: `Prot_${i + 1}`,
        category: center.cat,
        metadata: { node_id: i + 1, cluster: center.cat, degree: Math.floor(Math.random() * 12) + 2 },
      });

      // Internal cluster edges
      if (i > 0 && Math.random() < 0.6) {
        edges.push({
          source: i + 1,
          target: Math.max(1, i - Math.floor(Math.random() * 4)),
        });
      }

      // Inter-cluster corridor edge
      if (Math.random() < 0.08) {
        edges.push({
          source: i + 1,
          target: Math.floor(Math.random() * numNodes) + 1,
        });
      }
    }
  } else {
    // Generate UMAP / Single-Cell Clusters
    const clusterSpecs = [
      { name: 'T-Cell Activated', count: 180, cx: -15, cy: -10, sx: 4.5, sy: 3.5 },
      { name: 'B-Cell Memory', count: 140, cx: 12, cy: -12, sx: 4.0, sy: 4.0 },
      { name: 'Monocyte Macrophage', count: 200, cx: 0, cy: 12, sx: 5.5, sy: 4.0 },
      { name: 'Dendritic Precursor', count: 90, cx: -18, cy: 10, sx: 3.0, sy: 3.0 },
      { name: 'Natural Killer Cytotoxic', count: 120, cx: 16, cy: 11, sx: 3.5, sy: 5.0 },
    ];

    let ptId = 1;
    for (const spec of clusterSpecs) {
      for (let i = 0; i < spec.count; i++) {
        // Box-Muller gaussian
        const u1 = Math.random() || 0.001;
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

        const x = spec.cx + z0 * spec.sx;
        const y = spec.cy + z1 * spec.sy;

        points.push({
          id: ptId++,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          label: `Cell_${ptId}`,
          category: spec.name,
          metadata: { cell_barcode: `BC_${ptId}`, cell_type: spec.name, expression_level: Math.round(Math.random() * 100) },
        });
      }
    }
  }

  return { points, edges };
}

