import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WidgetSpec } from '@/services/types';

interface Props {
  widget: WidgetSpec;
  children: React.ReactNode;
}

/** Shared header/frame so every widget type looks consistent without each
 * one re-implementing title + drill-down affordance. */
export default function WidgetCard({ widget, children }: Props) {
  return (
    <Card className="p-5 h-[380px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground">{widget.title}</h3>
        {widget.drill_down?.enabled && (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
            Click to drill down
          </Badge>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </Card>
  );
}
