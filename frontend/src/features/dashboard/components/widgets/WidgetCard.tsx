import React, { useState, useRef, useEffect } from 'react';
import type { WidgetSpec } from '@/services/types';

interface Props {
  widget: WidgetSpec;
  children: React.ReactNode;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onFullscreen?: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

export default function WidgetCard({ widget, children, onEdit, onDuplicate, onFullscreen, onDelete, onDragStart }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className="widget-tile">
      <div className="widget-tile-header">
        {/* Drag grip — only this triggers drag */}
        <div
          className="widget-drag-grip"
          onPointerDown={(e) => { e.stopPropagation(); onDragStart?.(e); }}
          title="Drag to move"
        >
          <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
            <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
            <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
          </svg>
        </div>

        <span className="widget-tile-title">{widget.title}</span>

        <div className="widget-tile-actions" ref={menuRef}>
          {widget.drill_down?.enabled && (
            <span className="widget-drill-badge">drill-down</span>
          )}
          <button
            className="widget-menu-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          {menuOpen && (
            <div className="widget-context-menu">
              {[
                { label: 'Edit', action: onEdit },
                { label: 'Duplicate', action: onDuplicate },
                { label: 'Fullscreen', action: onFullscreen },
                { label: 'Delete', action: onDelete, danger: true },
              ].filter(i => i.action).map(item => (
                <button
                  key={item.label}
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
