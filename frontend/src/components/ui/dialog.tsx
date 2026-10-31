import React from 'react';
type DivProps = React.HTMLAttributes<HTMLDivElement>;

interface DialogProps { open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode; }
export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null;
  return (
    <div className="dialog-overlay" onClick={() => onOpenChange?.(false)}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
};
export const DialogContent = ({ className = '', ...p }: DivProps) => <div className={`dialog-body ${className}`} {...p} />;
export const DialogHeader = ({ className = '', ...p }: DivProps) => <div className={`dialog-header ${className}`} {...p} />;
export const DialogTitle = ({ className = '', ...p }: DivProps) => <div className={`dialog-title ${className}`} {...p} />;
