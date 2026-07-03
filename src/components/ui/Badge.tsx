import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'ghost' | 'neutral' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function Badge({ variant, size = 'md', className = '', children, ...props }: BadgeProps) {
  const variantClass = variant ? (variant === 'outline' ? 'badge-outline' : `badge-${variant}`) : '';
  const sizeClass = size === 'md' ? '' : `badge-${size}`;

  return (
    <span className={`badge ${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </span>
  );
}
