import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip as LeafletTooltip, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import { Layers } from 'lucide-react';

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
  actions?: WidgetActions;
}

function MapResizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * Tracks current map zoom level for spatial tile level-of-detail.
 */
function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  useMapEvents({
    zoomend: (e) => {
      onZoomChange(e.target.getZoom());
    },
  });
  return null;
}

export default function GisWidget({ widget, onRowClick, actions }: Props) {
  const gis = widget.gis ?? {
    lat_field: 'lat',
    lng_field: 'lng',
    geometry: 'point' as const,
    tooltip_fields: [],
  };
  const [boundary, setBoundary] = useState<any>(gis.geojson_data ?? null);
  const [mapZoom, setMapZoom] = useState<number>(4);
  const [enableTiling, setEnableTiling] = useState<boolean>(true);
  const accentColor = widget.color || '#06b6d4';

  useEffect(() => {
    if (gis?.geojson_data) {
      setBoundary(gis.geojson_data);
      return;
    }
    if ((gis?.geometry === 'choropleth' || gis?.geometry === 'polygon') && gis.boundary_geojson_url) {
      fetch(gis.boundary_geojson_url)
        .then((r) => r.json())
        .then(setBoundary)
        .catch(() => setBoundary(null));
    }
  }, [gis?.geometry, gis?.boundary_geojson_url, gis?.geojson_data]);

  const rows = Array.isArray(widget.data) ? widget.data : [];
  const points = useMemo(() => {
    return rows
      .map((row) => ({
        row,
        lat: Number(row[gis.lat_field] ?? row.latitude ?? row.lat),
        lng: Number(row[gis.lng_field] ?? row.longitude ?? row.lng ?? row.lon),
        weight: gis.weight_field ? Number(row[gis.weight_field]) || 1 : 1,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }, [rows, gis.lat_field, gis.lng_field, gis.weight_field]);

  // Spatial Tile Clustering (Supercluster-style spatial binning)
  const { clusteredTiles, isClustered } = useMemo(() => {
    if (!enableTiling || points.length < 40 || mapZoom >= 11 || gis.geometry === 'trajectory') {
      return { clusteredTiles: [], isClustered: false };
    }

    // Grid bin size scales with zoom level
    const binSizeDegrees = 180 / Math.pow(2, Math.max(1, mapZoom - 1));
    const bins = new Map<string, { latSum: number; lngSum: number; count: number; weightSum: number; points: typeof points }>();

    for (const p of points) {
      const bLat = Math.floor(p.lat / binSizeDegrees);
      const bLng = Math.floor(p.lng / binSizeDegrees);
      const key = `${bLat}_${bLng}`;

      let bin = bins.get(key);
      if (!bin) {
        bin = { latSum: 0, lngSum: 0, count: 0, weightSum: 0, points: [] };
        bins.set(key, bin);
      }
      bin.latSum += p.lat;
      bin.lngSum += p.lng;
      bin.count += 1;
      bin.weightSum += p.weight;
      bin.points.push(p);
    }

    const clusters = Array.from(bins.values()).map((b) => ({
      lat: b.latSum / b.count,
      lng: b.lngSum / b.count,
      count: b.count,
      weight: b.weightSum,
      sampleRow: b.points[0]?.row,
      points: b.points,
    }));

    return { clusteredTiles: clusters, isClustered: true };
  }, [points, mapZoom, enableTiling, gis.geometry]);

  const center: [number, number] = points.length
    ? [
        points.reduce((acc, p) => acc + p.lat, 0) / points.length,
        points.reduce((acc, p) => acc + p.lng, 0) / points.length,
      ]
    : [20, 0];

  const maxWeight = Math.max(...points.map((p) => p.weight), 1);
  const clickable = Boolean(widget.drill_down?.enabled && onRowClick);
  const tooltipFields = Array.isArray(gis.tooltip_fields) ? gis.tooltip_fields : [];

  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="flex flex-col h-full w-full gap-1.5">
        <div className="widget-metrics-strip flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="widget-metric-chip">
              <span className="widget-metric-label">Locations</span>
              <span className="widget-metric-val">{points.length.toLocaleString()}</span>
            </div>
            <div className="widget-metric-chip">
              <span className="widget-metric-label">Layer</span>
              <span className="widget-metric-val" style={{ textTransform: 'capitalize' }}>
                {String(gis.geometry || 'point')}
              </span>
            </div>
            {isClustered && (
              <div className="widget-metric-chip">
                <span className="widget-metric-label">Spatial Tiles</span>
                <span className="widget-metric-val">{clusteredTiles.length} clusters</span>
              </div>
            )}
          </div>

          {points.length >= 40 && (
            <button
              onClick={() => setEnableTiling((t) => !t)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                enableTiling ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Spatial Tile Clustering"
            >
              <Layers className="h-3 w-3" />
              <span>{enableTiling ? 'Tiling Active' : 'Points Raw'}</span>
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 w-full rounded-xl overflow-hidden border border-white/10 relative">
          <MapContainer center={center} zoom={points.length ? 4 : 2} className="h-full w-full">
            <MapResizeInvalidator />
            <ZoomTracker onZoomChange={setMapZoom} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url={gis.tile_url || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
            />
            {(gis.geometry === 'choropleth' || gis.geometry === 'polygon') && boundary && (
              <GeoJSON
                data={boundary}
                style={{ color: accentColor, weight: 1.5, fillColor: accentColor, fillOpacity: 0.22 }}
              />
            )}
            {gis.geometry === 'trajectory' && points.length > 1 && (
              <Polyline
                positions={points.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: accentColor, weight: 2.5, opacity: 0.8, dashArray: '6 4' }}
              />
            )}

            {/* Spatial Tile Clustering Markers */}
            {isClustered
              ? clusteredTiles.map((c, i) => {
                  const radius = Math.max(9, Math.min(26, 8 + Math.sqrt(c.count) * 2.2));
                  return (
                    <CircleMarker
                      key={`cluster_${i}`}
                      center={[c.lat, c.lng]}
                      radius={radius}
                      pathOptions={{
                        color: '#ffffff',
                        fillColor: accentColor,
                        weight: 1.8,
                        fillOpacity: 0.82,
                      }}
                      eventHandlers={clickable ? { click: () => onRowClick?.(c.sampleRow) } : undefined}
                    >
                      <LeafletTooltip direction="top" offset={[0, -radius]}>
                        <div className="text-xs">
                          <strong>{c.count} items in tile</strong>
                          <div className="text-[10px] text-slate-400">Lat: {c.lat.toFixed(2)}, Lng: {c.lng.toFixed(2)}</div>
                        </div>
                      </LeafletTooltip>
                    </CircleMarker>
                  );
                })
              : gis.geometry !== 'choropleth' &&
                points.map((p, i) => {
                  const isHeatmap = gis.geometry === 'heatmap';
                  const radius = isHeatmap ? 6 + (p.weight / maxWeight) * 18 : 7;
                  return (
                    <CircleMarker
                      key={i}
                      center={[p.lat, p.lng]}
                      radius={radius}
                      pathOptions={{
                        color: accentColor,
                        fillColor: accentColor,
                        weight: 1.5,
                        fillOpacity: isHeatmap ? 0.28 + 0.42 * (p.weight / maxWeight) : 0.65,
                      }}
                      eventHandlers={clickable ? { click: () => onRowClick?.(p.row) } : undefined}
                    >
                      {tooltipFields.length > 0 && (
                        <LeafletTooltip>
                          {tooltipFields.map((f) => `${f}: ${p.row[f] ?? '—'}`).join(' · ')}
                        </LeafletTooltip>
                      )}
                    </CircleMarker>
                  );
                })}
          </MapContainer>
        </div>
      </div>
    </WidgetCard>
  );
}
