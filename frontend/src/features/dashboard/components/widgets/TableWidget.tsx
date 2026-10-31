import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';
import type { WidgetActions } from './WidgetRenderer';

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
  actions?: WidgetActions;
}

function isNumericValue(v: any): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v));
  return false;
}

function formatCellValue(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

export default function TableWidget({ widget, onRowClick, actions }: Props) {
  const columns = widget.data.length > 0 ? Object.keys(widget.data[0]) : [];
  const clickable = Boolean(widget.drill_down?.enabled && onRowClick);
  const sampleRow = widget.data[0] ?? {};

  return (
    <WidgetCard widget={widget} {...actions}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <Table>
            <TableHeader>
              <TableRow style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                {columns.map((c) => {
                  const numeric = isNumericValue(sampleRow[c]);
                  return (
                    <TableHead
                      key={c}
                      className={`sticky top-0 z-10 py-2 text-[10px] font-bold uppercase tracking-wider ${numeric ? 'text-right' : 'text-left'}`}
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                    >
                      {c.replace(/_/g, ' ')}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {widget.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={Math.max(columns.length, 1)} className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    No rows to display
                  </TableCell>
                </TableRow>
              ) : (
                widget.data.map((row, i) => (
                  <TableRow
                    key={i}
                    className={`transition-colors ${clickable ? 'cursor-pointer hover:bg-blue-500/10' : 'hover:bg-white/[0.03]'}`}
                    style={{
                      background: i % 2 === 1 ? 'color-mix(in srgb, var(--bg-surface) 45%, transparent)' : 'transparent',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                    onClick={() => clickable && onRowClick?.(row)}
                  >
                    {columns.map((c) => {
                      const numeric = isNumericValue(row[c]);
                      return (
                        <TableCell
                          key={c}
                          className={`py-1.5 text-xs ${numeric ? 'text-right font-medium tabular-nums' : 'text-left'}`}
                          style={{ color: numeric ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        >
                          {formatCellValue(row[c])}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {widget.data.length > 0 && (
          <div
            className="flex items-center justify-between px-3 py-1 text-[10px]"
            style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            <span>{widget.data.length.toLocaleString()} rows</span>
            <span>{columns.length} columns</span>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

