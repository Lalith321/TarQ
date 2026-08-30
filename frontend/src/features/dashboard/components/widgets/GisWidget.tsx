import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
}

/**
 * Renders point/heatmap/choropleth geodata with no map API key — tiles come
 * from the public OpenStreetMap tile server. See LIMITATIONS.md: OSM's tile
 * usage policy is not meant for production traffic, and "heatmap" here is a
 * weight-scaled circle-marker approximation, not a real density surface
 * (that needs the leaflet.heat plugin, deliberately not added as a new
 * dependency in this pass).
 */
export default function GisWidget({ widget, onRowClick }: Props) {
  const gis = widget.gis;
  const [boundary, setBoundary] = useState<any>(null);

  useEffect(() => {
    if (gis?.geometry === 'choropleth' && gis.boundary_geojson_url) {
      fetch(gis.boundary_geojson_url)
        .then((r) => r.json())
        .then(setBoundary)
        .catch(() => setBoundary(null));
    }
  }, [gis?.geometry, gis?.boundary_geojson_url]);

  if (!gis) {
    return (
      <WidgetCard widget={widget}>
        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
          Widget declared type "gis" but has no gis config — nothing to render.
        </div>
      </WidgetCard>
    );
  }

  const points = widget.data
    .map((row) => ({
      row,
      lat: Number(row[gis.lat_field]),
      lng: Number(row[gis.lng_field]),
      weight: gis.weight_field ? Number(row[gis.weight_field]) : 1,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : [20, 0]; // fallback: roughly centered world view when there's no data yet

  const maxWeight = Math.max(...points.map((p) => p.weight), 1);
  const clickable = Boolean(widget.drill_down?.enabled && onRowClick);

  return (
    <WidgetCard widget={widget}>
      <MapContainer center={center} zoom={points.length ? 3 : 2} className="h-full w-full rounded-lg">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {gis.geometry === 'choropleth' && boundary && (
          <GeoJSON data={boundary} style={{ color: 'hsl(var(--primary))', weight: 1, fillOpacity: 0.15 }} />
        )}
        {gis.geometry !== 'choropleth' &&
          points.map((p, i) => {
            const isHeatmap = gis.geometry === 'heatmap';
            const radius = isHeatmap ? 6 + (p.weight / maxWeight) * 18 : 7;
            return (
              <CircleMarker
                key={i}
                center={[p.lat, p.lng]}
                radius={radius}
                pathOptions={{
                  color: 'hsl(var(--primary))',
                  fillColor: 'hsl(var(--primary))',
                  fillOpacity: isHeatmap ? 0.25 + 0.35 * (p.weight / maxWeight) : 0.6,
                }}
                eventHandlers={clickable ? { click: () => onRowClick?.(p.row) } : undefined}
              >
                {gis.tooltip_fields.length > 0 && (
                  <LeafletTooltip>
                    {gis.tooltip_fields.map((f) => `${f}: ${p.row[f]}`).join(' · ')}
                  </LeafletTooltip>
                )}
              </CircleMarker>
            );
          })}
      </MapContainer>
    </WidgetCard>
  );
}
