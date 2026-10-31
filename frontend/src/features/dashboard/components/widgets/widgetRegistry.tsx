import React from 'react';
import type { WidgetSpec, WidgetType } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';
import BarWidget from './BarWidget';
import LineWidget from './LineWidget';
import PieWidget from './PieWidget';
import AreaWidget from './AreaWidget';
import TableWidget from './TableWidget';
import StatWidget from './StatWidget';
import GisWidget from './GisWidget';
import ScatterWidget from './ScatterWidget';
import ManhattanWidget from './ManhattanWidget';
import VolcanoWidget from './VolcanoWidget';
import HeatmapWidget from './HeatmapWidget';
import TiledStructureWidget from './TiledStructureWidget';

export interface WidgetComponentProps {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
  actions?: WidgetActions;
}

/**
 * family:   widgets in the same family read compatible fields, so the user may
 *           switch between them in the Customize drawer.
 * pickable: shown as an option in the Customize drawer's "Visual Style" list.
 */
export interface WidgetDefinition {
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<WidgetComponentProps>;
  family: 'chart' | 'genetics' | 'map';
  pickable: boolean;
}

const svg = (children: React.ReactNode) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICONS = {
  bar: svg(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  line: svg(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />),
  area: svg(<path d="M3 18v-6l5-5 5 4 8-7v14H3z" />),
  pie: svg(<><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>),
  stat: svg(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  table: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="9" x2="9" y2="21" /></>),
  gis: svg(<><circle cx="12" cy="10" r="3" /><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" /></>),
  scatter: svg(<><circle cx="7.5" cy="7.5" r="2" /><circle cx="16.5" cy="9.5" r="2" /><circle cx="10.5" cy="15.5" r="2" /><circle cx="17" cy="16.5" r="2" /></>),
  dna: svg(<><path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" /><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" /></>),
  heatmap: svg(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>),
  tile: svg(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><circle cx="12" cy="12" r="2" fill="currentColor" /></>),
};

/**
 * The one and only list of widget types the dashboard can render.
 * Adding a widget type = add it to WidgetType (services/types.ts + backend
 * schemas.py) and add one entry here. Anything not listed is rejected.
 */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  bar:         { label: 'Bar Chart',      icon: ICONS.bar,     component: BarWidget,       family: 'chart',    pickable: true },
  stacked_bar: { label: 'Stacked Bar',    icon: ICONS.bar,     component: BarWidget,       family: 'chart',    pickable: false },
  line:        { label: 'Line Chart',     icon: ICONS.line,    component: LineWidget,      family: 'chart',    pickable: true },
  multi_line:  { label: 'Multi-Line',     icon: ICONS.line,    component: LineWidget,      family: 'chart',    pickable: false },
  area:        { label: 'Area Chart',     icon: ICONS.area,    component: AreaWidget,      family: 'chart',    pickable: true },
  pie:         { label: 'Donut / Pie',    icon: ICONS.pie,     component: PieWidget,       family: 'chart',    pickable: true },
  stat:        { label: 'KPI Card',       icon: ICONS.stat,    component: StatWidget,      family: 'chart',    pickable: true },
  table:       { label: 'Data Table',     icon: ICONS.table,   component: TableWidget,     family: 'chart',    pickable: true },
  scatter:     { label: 'Scatter / PCA',  icon: ICONS.scatter, component: ScatterWidget,   family: 'genetics', pickable: true },
  manhattan:   { label: 'Manhattan Plot', icon: ICONS.dna,     component: ManhattanWidget, family: 'genetics', pickable: true },
  volcano:     { label: 'Volcano Plot',   icon: ICONS.dna,     component: VolcanoWidget,   family: 'genetics', pickable: true },
  heatmap:     { label: 'Heatmap Matrix', icon: ICONS.heatmap, component: HeatmapWidget,   family: 'genetics', pickable: true },
  tiled_structure: { label: 'Tiled Structure (LoD)', icon: ICONS.tile, component: TiledStructureWidget, family: 'genetics', pickable: true },
  gis:         { label: 'Map',            icon: ICONS.gis,     component: GisWidget,       family: 'map',      pickable: false },
};

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(WIDGET_REGISTRY, type)
    ? WIDGET_REGISTRY[type as WidgetType]
    : undefined;
}

/** Types the user can switch the given widget to in the Customize drawer. */
export function switchableTypes(type: string): { id: WidgetType; label: string }[] {
  const current = getWidgetDefinition(type);
  if (!current) return [];
  return (Object.entries(WIDGET_REGISTRY) as [WidgetType, WidgetDefinition][])
    .filter(([, def]) => def.pickable && def.family === current.family)
    .map(([id, def]) => ({ id, label: def.label }));
}

