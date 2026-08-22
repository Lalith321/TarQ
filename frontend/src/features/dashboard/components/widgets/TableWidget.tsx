import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import WidgetCard from './WidgetCard';
import type { WidgetSpec } from '@/services/types';

interface Props {
  widget: WidgetSpec;
  onRowClick?: (row: Record<string, any>) => void;
}

/** Columns are derived from the data itself — this widget makes no
 * assumption about what fields exist, which is what lets it double as the
 * generic drill-down result renderer. */
export default function TableWidget({ widget, onRowClick }: Props) {
  const columns = widget.data.length > 0 ? Object.keys(widget.data[0]) : [];
  const clickable = Boolean(widget.drill_down?.enabled && onRowClick);

  return (
    <WidgetCard widget={widget}>
      <div className="overflow-auto h-full custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c} className="text-[10px] uppercase tracking-wide">
                  {c.replace(/_/g, ' ')}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {widget.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1)} className="text-center py-8 text-muted-foreground text-xs">
                  No rows to display
                </TableCell>
              </TableRow>
            ) : (
              widget.data.map((row, i) => (
                <TableRow
                  key={i}
                  className={clickable ? 'cursor-pointer hover:bg-muted/30' : undefined}
                  onClick={() => clickable && onRowClick?.(row)}
                >
                  {columns.map((c) => (
                    <TableCell key={c} className="text-xs">
                      {String(row[c] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </WidgetCard>
  );
}
