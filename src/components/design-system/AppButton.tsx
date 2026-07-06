import React, { ButtonHTMLAttributes } from 'react';

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all rounded-[18px] focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed';
  
  const sizeStyles = {
    sm: 'py-2 px-3 text-xs gap-1.5',
    md: 'py-3.5 px-4 text-sm gap-2',
    lg: 'py-4 px-5 text-base gap-2.5'
  };

  const variantStyles = {
    primary: 'bg-primary hover:bg-[#B92E0C] text-white shadow-[0_4px_12px_-4px_rgba(209,53,15,0.4)] border border-transparent',
    secondary: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm border border-transparent'
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"></div>
      )}
      {children}
    </button>
  );
};
