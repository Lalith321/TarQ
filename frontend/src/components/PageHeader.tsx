import React from 'react';
interface Props { title: string; subtitle?: string; children?: React.ReactNode; }
export default function PageHeader({ title, subtitle, children }: Props) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
