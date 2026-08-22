import React from 'react';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string; size?: string;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant, size, ...props }, ref) =>
    <button ref={ref} className={`btn ${variant ?? ''} ${size ?? ''} ${className}`} {...props} />
);
Button.displayName = 'Button';
