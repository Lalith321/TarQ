import React from 'react';
type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { variant?: string };
export const Badge = ({ className = '', variant, ...p }: BadgeProps) =>
  <span className={`badge${variant ? ` badge-${variant}` : ''} ${className}`} {...p} />;
