import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'ghost' | 'outline' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function Button({ variant, size = 'md', className = '', children, ...props }: ButtonProps) {
  const variantClass = variant ? (variant === 'outline' ? 'btn-outline' : `btn-${variant}`) : '';
  const sizeClass = size === 'md' ? '' : `btn-${size}`;

  return (
    <button 
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
