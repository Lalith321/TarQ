import React, { useState, useRef, useEffect } from 'react';
import type { WidgetSpec } from '@/services/types';
import { widgetColor } from '../DashboardBuilder';
import { getWidgetDefinition } from './widgetRegistry';

interface Props {
  widget: WidgetSpec;
  children: React.ReactNode;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onFullscreen?: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

function getWidgetTypeIcon(type: string) {
  return getWidgetDefinition(type)?.icon ?? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

export default function WidgetCard({ widget, children, onEdit, onDuplicate, onFullscreen, onDelete, onDragStart }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accent = widget.color ?? widgetColor(widget.id);
  const rowCount = Array.isArray(widget.data) ? widget.data.length : 0;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !onDragStart) return;
    const target = e.target as HTMLElement;
    if (target.closest('.widget-tile-actions') || target.closest('button')) return;
    onDragStart(e);
  };

  return (
    <div
      className="widget-tile"
      style={{ '--widget-accent': accent } as React.CSSProperties}
    >
      <div
        className="widget-tile-header"
        onPointerDown={handleHeaderPointerDown}
        onDoubleClick={() => onFullscreen?.()}
        title={onDragStart ? 'Drag header to move · Double-click to expand' : widget.title}
      >
        {/* Drag grip */}
        {onDragStart && (
          <div
            className="widget-drag-grip"
            onPointerDown={(e) => { e.stopPropagation(); onDragStart(e); }}
            title="Drag to move"
          >
            <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2.5" cy="2.5" r="1.4"/><circle cx="7.5" cy="2.5" r="1.4"/>
              <circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/>
              <circle cx="2.5" cy="13.5" r="1.4"/><circle cx="7.5" cy="13.5" r="1.4"/>
            </svg>
          </div>
        )}

        <div className="widget-type-icon" title={`Type: ${widget.type}`}>
          {getWidgetTypeIcon(widget.type)}
        </div>

        <div className="widget-tile-title-wrap">
          <span className="widget-tile-title">{widget.title}</span>
          {widget.type !== 'stat' && rowCount > 0 && (
            <span className="widget-meta-pill">{rowCount.toLocaleString()} pts</span>
          )}
        </div>

        <div className="widget-tile-actions" ref={menuRef} onPointerDown={(e) => e.stopPropagation()}>
          {widget.drill_down?.enabled && (
            <span className="widget-drill-badge">Drill</span>
          )}
          {onFullscreen && (
            <button
              type="button"
              className="widget-action-btn"
              onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
              title="Fullscreen"
              aria-label="Fullscreen widget"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className="widget-action-btn"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Configure widget"
              aria-label="Edit widget"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          )}
          {(onEdit || onDuplicate || onFullscreen || onDelete) && (
            <button
              type="button"
              className="widget-menu-btn"
              data-open={menuOpen ? 'true' : 'false'}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              title="More options"
              aria-label="Widget options"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
          )}
          {menuOpen && (
            <div className="widget-context-menu">
              {[
                { label: 'Customize', action: onEdit },
                { label: 'Duplicate', action: onDuplicate },
                { label: 'Fullscreen', action: onFullscreen },
                { label: 'Delete', action: onDelete, danger: true },
              ].filter(i => i.action).map(item => (
                <button
                  key={item.label}
                  type="button"
                  className={`widget-context-item${item.danger ? ' danger' : ''}`}
                  onClick={() => { item.action?.(); setMenuOpen(false); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="widget-tile-body">
        {children}
      </div>
    </div>
  );
}

