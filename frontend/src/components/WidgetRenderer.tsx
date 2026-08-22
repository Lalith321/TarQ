import { useMemo } from 'react';
import type { WidgetSpec, TableColumn, TableRow } from '../types';

interface Props {
  widget: WidgetSpec;
  onDrillDown?: (row: Record<string, any>) => void;
  className?: string;
}

function SimpleBarChart({ series, labels }: { series?: any[]; labels?: string[] }) {
  const max = useMemo(() => {
    if (!series?.length) return 1;
    return Math.max(...series.flatMap((s) => s.data.map((d: any) => d.y)));
  }, [series]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-1 items-end gap-2">
        {labels?.map((label, i) => {
          const val = series?.[0]?.data[i]?.y ?? 0;
          const pct = max ? (val / max) * 100 : 0;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-indigo-500 transition-all"
                style={{ height: `${pct}%`, minHeight: pct > 0 ? 4 : 0 }}
              />
              <span className="text-[10px] text-gray-500 truncate max-w-full">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SimpleLineChart({ series }: { series?: any[] }) {
  if (!series?.[0]?.data?.length) return null;
  const data = series[0].data;
  const max = Math.max(...data.map((d: any) => d.y));
  const min = Math.min(...data.map((d: any) => d.y));
  const range = max - min || 1;
  const points = data
    .map((d: any, i: number) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d.y - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <polyline
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
      {data.map((d: any, i: number) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d.y - min) / range) * 100;
        return <circle key={i} cx={x} cy={y} r="1.5" fill="#6366f1" />;
      })}
    </svg>
  );
}

function SimpleAreaChart({ series }: { series?: any[] }) {
  if (!series?.[0]?.data?.length) return null;
  const data = series[0].data;
  const max = Math.max(...data.map((d: any) => d.y));
  const min = Math.min(...data.map((d: any) => d.y));
  const range = max - min || 1;
  const points = data
    .map((d: any, i: number) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d.y - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <polygon
        fill="#e0e7ff"
        stroke="none"
        points={`0,100 ${points} 100,100`}
      />
      <polyline
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SimplePieChart({ series }: { series?: any[] }) {
  const total = useMemo(() => {
    return series?.[0]?.data?.reduce((sum: number, d: any) => sum + (d.y || 0), 0) || 1;
  }, [series]);

  const slices = useMemo(() => {
    if (!series?.[0]?.data) return [];
    let acc = 0;
    return series[0].data.map((d: any, i: number) => {
      const start = acc;
      const frac = (d.y || 0) / total;
      acc += frac;
      return { label: d.x, value: d.y, start, frac, i };
    });
  }, [series, total]);

  return (
    <div className="flex h-full items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-full max-h-[200px]">
        {slices.map((s) => {
          const x1 = 50 + 40 * Math.cos((s.start - 0.25) * Math.PI * 2);
          const y1 = 50 + 40 * Math.sin((s.start - 0.25) * Math.PI * 2);
          const x2 = 50 + 40 * Math.cos((s.start + s.frac - 0.25) * Math.PI * 2);
          const y2 = 50 + 40 * Math.sin((s.start + s.frac - 0.25) * Math.PI * 2);
          const largeArc = s.frac > 0.5 ? 1 : 0;
          return (
            <path
              key={s.i}
              d={`M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`}
              fill={['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][s.i % 5]}
              stroke="white"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1 text-xs">
        {slices.map((s) => (
          <div key={s.i} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][s.i % 5] }}
            />
            <span className="text-gray-600">{s.label}</span>
            <span className="ml-auto font-medium text-gray-900">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable({ columns, rows, onRowClick }: { columns?: TableColumn[]; rows?: TableRow[]; onRowClick?: (row: TableRow) => void }) {
  if (!columns?.length) return <div className="text-sm text-gray-400">No columns defined</div>;
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {(rows ?? []).map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 text-gray-700">
                  {row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GisPlaceholder({ features }: { features?: any[] }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 text-slate-400">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span className="text-xs">GIS Map ({features?.length ?? 0} features)</span>
      <span className="text-[10px]">Integrate with Mapbox / Leaflet here</span>
    </div>
  );
}

export function WidgetRenderer({ widget, onDrillDown, className = '' }: Props) {
  const content = (() => {
    switch (widget.type) {
      case 'bar':
        return <SimpleBarChart series={widget.series} labels={widget.labels} />;
      case 'line':
        return <SimpleLineChart series={widget.series} />;
      case 'area':
        return <SimpleAreaChart series={widget.series} />;
      case 'pie':
        return <SimplePieChart series={widget.series} />;
      case 'table':
        return <DataTable columns={widget.columns} rows={widget.rows} onRowClick={onDrillDown} />;
      case 'gis':
        return <GisPlaceholder features={widget.features} />;
      default:
        return <div className="text-sm text-gray-400">Unknown widget type</div>;
    }
  })();

  return (
    <div className={`flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-gray-100 px-4 py-3">
        <h4 className="text-sm font-semibold text-gray-900">{widget.title}</h4>
        {widget.subtitle && <p className="text-xs text-gray-500">{widget.subtitle}</p>}
      </div>
      <div className="flex-1 p-4 min-h-[180px]">{content}</div>
    </div>
  );
}