import React from 'react';
type DivProps = React.HTMLAttributes<HTMLElement>;
export const Table = ({ className = '', ...p }: DivProps) => <table className={`table ${className}`} {...(p as React.HTMLAttributes<HTMLTableElement>)} />;
export const TableHeader = ({ ...p }: DivProps) => <thead {...(p as React.HTMLAttributes<HTMLTableSectionElement>)} />;
export const TableBody = ({ ...p }: DivProps) => <tbody {...(p as React.HTMLAttributes<HTMLTableSectionElement>)} />;
export const TableRow = ({ className = '', ...p }: DivProps) => <tr className={className} {...(p as React.HTMLAttributes<HTMLTableRowElement>)} />;
export const TableHead = ({ className = '', ...p }: DivProps) => <th className={`th ${className}`} {...(p as React.ThHTMLAttributes<HTMLTableCellElement>)} />;
export const TableCell = ({ className = '', ...p }: React.TdHTMLAttributes<HTMLTableDataCellElement>) => <td className={`td ${className}`} {...p} />;
