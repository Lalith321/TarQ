import React, { useMemo } from 'react';
import type { WidgetSpec } from '@/services/types';
import WidgetRenderer from './widgets/WidgetRenderer';

interface Props {
  widgets: WidgetSpec[];
  onDrillDown: (widget: WidgetSpec, row: Record<string, any>) => void;
}

const GRID_COLUMNS = 12;
const COL_WIDTH = 280;   // px per column
const ROW_HEIGHT = 220;  // px per row
const GAP = 16;          // px

/**
 * Auto-place widgets that are missing x/y by packing them into the first
 * available slot on a 12-column grid.
 */
function normalizeWidgets(widgets: WidgetSpec[]): WidgetSpec[] {
  const occupied: boolean[][] = []; // occupied[row][col]

  function isFree(x: number, y: number, w: number, h: number): boolean {
    for (let r = y; r < y + h; r++) {
      if (!occupied[r]) occupied[r] = [];
      for (let c = x; c < x + w; c++) {
        if (c >= GRID_COLUMNS) return false;
        if (occupied[r][c]) return false;
      }
    }
    return true;
  }

  function occupy(x: number, y: number, w: number, h: number) {
    for (let r = y; r < y + h; r++) {
      if (!occupied[r]) occupied[r] = [];
      for (let c = x; c < x + w; c++) {
        occupied[r][c] = true;
      }
    }
  }

  return widgets.map((widget) => {
    const pos = widget.position ?? { w: 6, h: 4 };
    const w = Math.min(pos.w ?? 6, GRID_COLUMNS);
    const h = pos.h ?? 4;

    // If x and y are explicitly provided, trust them
    if (typeof pos.x === 'number' && typeof pos.y === 'number') {
      occupy(pos.x, pos.y, w, h);
      return widget;
    }

    // Otherwise, find first free slot
    for (let y = 0; ; y++) {
      for (let x = 0; x <= GRID_COLUMNS - w; x++) {
        if (isFree(x, y, w, h)) {
          occupy(x, y, w, h);
          return { ...widget, position: { x, y, w, h } };
        }
      }
    }
  });
}

export function DashboardGrid({ widgets, onDrillDown }: Props) {
  const placed = useMemo(() => normalizeWidgets(widgets), [widgets]);

  // Compute canvas size from widget extents
  const maxRow = useMemo(() => {
    return placed.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 4);
  }, [placed]);

  const canvasWidth = GRID_COLUMNS * COL_WIDTH + (GRID_COLUMNS - 1) * GAP;
  const canvasHeight = maxRow * ROW_HEIGHT + (maxRow - 1) * GAP;

  return (
    <div
      className="relative"
      style={{
        width: canvasWidth,
        height: canvasHeight,
        padding: GAP,
      }}
    >
      {placed.map((widget) => {
        const { x, y, w, h } = widget.position;
        const left = x * (COL_WIDTH + GAP);
        const top = y * (ROW_HEIGHT + GAP);
        const width = w * COL_WIDTH + (w - 1) * GAP;
        const height = h * ROW_HEIGHT + (h - 1) * GAP;

        return (
          <div
            key={widget.id}
            data-widget
            className="absolute"
            style={{
              left,
              top,
              width,
              height,
            }}
          >
            <WidgetRenderer
              widget={widget}
              onDrillDown={widget.drill_down?.enabled ? onDrillDown : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}