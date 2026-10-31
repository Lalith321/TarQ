/**
 * TarQ Spatial Tiling Engine
 * High-performance hierarchical spatial partitioning, viewport culling,
 * and Level-of-Detail (LoD) aggregation for massive datasets:
 * - High-dimensional Clusters (UMAP, t-SNE, single-cell)
 * - Large-scale Graphs & Interactomes (knowledge graphs, networks)
 * - Geospatial Point Clouds & Vector Maps
 * - Macromolecular & Atomic Coordinate Structures (proteins, lattices)
 */

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpatialPoint {
  x: number;
  y: number;
  z?: number;
  id?: string | number;
  label?: string;
  category?: string;
  weight?: number;
  color?: string;
  radius?: number;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  source: string | number;
  target: string | number;
  weight?: number;
  category?: string;
}

export interface SpatialTile<T extends SpatialPoint = SpatialPoint> {
  id: string; // "z_x_y"
  z: number;
  x: number;
  y: number;
  bounds: BoundingBox;
  count: number;
  density: number; // 0.0 - 1.0
  centroid: { x: number; y: number };
  variance: { vx: number; vy: number; radius: number };
  dominantCategory?: string;
  color?: string;
  items: T[];
}

export interface ViewportTransform {
  zoom: number; // e.g. 1.0 = fit, 10.0 = deep zoom
  panX: number;
  panY: number;
  viewWidth: number;
  viewHeight: number;
}

/**
 * Computes bounding box enclosing all points with padding.
 */
export function computeBounds(points: SpatialPoint[], paddingRatio: number = 0.05): BoundingBox {
  if (points.length === 0) {
    return { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const dx = (maxX - minX) || 1;
  const dy = (maxY - minY) || 1;
  const padX = dx * paddingRatio;
  const padY = dy * paddingRatio;

  return {
    minX: minX - padX,
    minY: minY - padY,
    maxX: maxX + padX,
    maxY: maxY + padY,
  };
}

/**
 * Spatial Tile Grid: Partitions 2D coordinate space into 2^z x 2^z tiles.
 */
export class SpatialTileIndex<T extends SpatialPoint = SpatialPoint> {
  public globalBounds: BoundingBox;
  private tilesByZoom: Map<number, Map<string, SpatialTile<T>>> = new Map();
  private maxZoom: number;

  constructor(points: T[], maxZoom: number = 5) {
    this.maxZoom = maxZoom;
    this.globalBounds = computeBounds(points);
    this.buildPyramid(points);
  }

  private buildPyramid(points: T[]) {
    const { minX, minY, maxX, maxY } = this.globalBounds;
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    for (let z = 0; z <= this.maxZoom; z++) {
      const numTilesAxis = Math.pow(2, z);
      const tileWidth = width / numTilesAxis;
      const tileHeight = height / numTilesAxis;
      const zoomMap = new Map<string, SpatialTile<T>>();

      // 1. Bin points into tiles
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let tx = Math.floor((p.x - minX) / tileWidth);
        let ty = Math.floor((p.y - minY) / tileHeight);

        // Clamp to edge
        tx = Math.max(0, Math.min(numTilesAxis - 1, tx));
        ty = Math.max(0, Math.min(numTilesAxis - 1, ty));

        const tileId = `${z}_${tx}_${ty}`;
        let tile = zoomMap.get(tileId);

        if (!tile) {
          tile = {
            id: tileId,
            z,
            x: tx,
            y: ty,
            bounds: {
              minX: minX + tx * tileWidth,
              minY: minY + ty * tileHeight,
              maxX: minX + (tx + 1) * tileWidth,
              maxY: minY + (ty + 1) * tileHeight,
            },
            count: 0,
            density: 0,
            centroid: { x: 0, y: 0 },
            variance: { vx: 0, vy: 0, radius: 0 },
            items: [],
          };
          zoomMap.set(tileId, tile);
        }
        tile.items.push(p);
      }

      // 2. Compute aggregate metrics for each tile
      let maxCountInZoom = 1;
      for (const tile of zoomMap.values()) {
        tile.count = tile.items.length;
        if (tile.count > maxCountInZoom) maxCountInZoom = tile.count;

        let sumX = 0;
        let sumY = 0;
        const categoryFreq: Record<string, number> = {};

        for (const item of tile.items) {
          sumX += item.x;
          sumY += item.y;
          if (item.category) {
            categoryFreq[item.category] = (categoryFreq[item.category] || 0) + 1;
          }
        }

        const cx = sumX / tile.count;
        const cy = sumY / tile.count;
        tile.centroid = { x: cx, y: cy };

        // Variance & radius of gyration
        let sqDiffSum = 0;
        for (const item of tile.items) {
          sqDiffSum += (item.x - cx) ** 2 + (item.y - cy) ** 2;
        }
        const radius = Math.sqrt(sqDiffSum / tile.count) || (tileWidth * 0.2);
        tile.variance = { vx: radius, vy: radius, radius };

        // Dominant category
        let domCat = '';
        let domCount = -1;
        for (const [cat, cnt] of Object.entries(categoryFreq)) {
          if (cnt > domCount) {
            domCount = cnt;
            domCat = cat;
          }
        }
        tile.dominantCategory = domCat || undefined;
      }

      // Normalize density
      for (const tile of zoomMap.values()) {
        tile.density = Math.min(1.0, tile.count / maxCountInZoom);
      }

      this.tilesByZoom.set(z, zoomMap);
    }
  }

  /**
   * Queries tiles that intersect the active viewport at given zoom level.
   */
  public queryViewport(
    viewportBounds: BoundingBox,
    targetZoom: number
  ): {
    tiles: SpatialTile<T>[];
    zoomLevel: number;
    totalPointsCulled: number;
    totalPointsVisible: number;
  } {
    const z = Math.max(0, Math.min(this.maxZoom, Math.floor(targetZoom)));
    const zoomMap = this.tilesByZoom.get(z);
    if (!zoomMap) {
      return { tiles: [], zoomLevel: z, totalPointsCulled: 0, totalPointsVisible: 0 };
    }

    const visibleTiles: SpatialTile<T>[] = [];
    let visiblePoints = 0;
    let culledPoints = 0;

    for (const tile of zoomMap.values()) {
      // Check AABB intersection
      const intersects =
        tile.bounds.minX <= viewportBounds.maxX &&
        tile.bounds.maxX >= viewportBounds.minX &&
        tile.bounds.minY <= viewportBounds.maxY &&
        tile.bounds.maxY >= viewportBounds.minY;

      if (intersects) {
        visibleTiles.push(tile);
        visiblePoints += tile.count;
      } else {
        culledPoints += tile.count;
      }
    }

    return {
      tiles: visibleTiles,
      zoomLevel: z,
      totalPointsCulled: culledPoints,
      totalPointsVisible: visiblePoints,
    };
  }

  /**
   * Translates screen coordinates (px) to spatial world coordinates.
   */
  public screenToWorld(
    screenX: number,
    screenY: number,
    transform: ViewportTransform
  ): { x: number; y: number } {
    const { minX, minY, maxX, maxY } = this.globalBounds;
    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;

    // Inverse scaling & offset
    const scale = Math.min(transform.viewWidth / worldW, transform.viewHeight / worldH) * transform.zoom;
    const originScreenX = transform.viewWidth / 2 + transform.panX;
    const originScreenY = transform.viewHeight / 2 + transform.panY;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const worldX = cx + (screenX - originScreenX) / scale;
    const worldY = cy - (screenY - originScreenY) / scale; // Invert Y for canvas

    return { x: worldX, y: worldY };
  }

  /**
   * Translates spatial world coordinates to screen pixel coordinates.
   */
  public worldToScreen(
    worldX: number,
    worldY: number,
    transform: ViewportTransform
  ): { x: number; y: number } {
    const { minX, minY, maxX, maxY } = this.globalBounds;
    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;

    const scale = Math.min(transform.viewWidth / worldW, transform.viewHeight / worldH) * transform.zoom;
    const originScreenX = transform.viewWidth / 2 + transform.panX;
    const originScreenY = transform.viewHeight / 2 + transform.panY;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const screenX = originScreenX + (worldX - cx) * scale;
    const screenY = originScreenY - (worldY - cy) * scale;

    return { x: screenX, y: screenY };
  }

  /**
   * Computes the bounding box currently visible on screen.
   */
  public getVisibleBounds(transform: ViewportTransform): BoundingBox {
    const pTopLeft = this.screenToWorld(0, 0, transform);
    const pBottomRight = this.screenToWorld(transform.viewWidth, transform.viewHeight, transform.zoom ? transform : { ...transform, zoom: 1 });

    return {
      minX: Math.min(pTopLeft.x, pBottomRight.x),
      minY: Math.min(pTopLeft.y, pBottomRight.y),
      maxX: Math.max(pTopLeft.x, pBottomRight.x),
      maxY: Math.max(pTopLeft.y, pBottomRight.y),
    };
  }
}

/**
 * Standard CPK Color Scheme for molecular atoms & biological structures.
 */
export const CPK_ATOM_COLORS: Record<string, string> = {
  C: '#64748b', // Carbon (Slate)
  N: '#3b82f6', // Nitrogen (Blue)
  O: '#ef4444', // Oxygen (Red)
  S: '#eab308', // Sulfur (Yellow)
  P: '#f97316', // Phosphorus (Orange)
  H: '#e2e8f0', // Hydrogen (Light Gray)
  FE: '#b91c1c', // Iron
  MG: '#10b981', // Magnesium
  CA: '#06b6d4', // Calcium
  DEFAULT: '#8b5cf6', // Generic / Unknown (Purple)
};

export const CLUSTER_PALETTE = [
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#84cc16', // Lime
];

