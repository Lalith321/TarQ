import React from 'react';
type DivProps = React.HTMLAttributes<HTMLDivElement>;
export const Card = ({ className = '', ...p }: DivProps) => <div className={`card ${className}`} {...p} />;
export const CardHeader = ({ className = '', ...p }: DivProps) => <div className={`card-header ${className}`} {...p} />;
export const CardTitle = ({ className = '', ...p }: DivProps) => <div className={`card-title ${className}`} {...p} />;
export const CardContent = ({ className = '', ...p }: DivProps) => <div className={`card-content ${className}`} {...p} />;
