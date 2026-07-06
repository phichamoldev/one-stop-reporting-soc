import React from 'react';

interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated';
  as?: React.ElementType;
}

export const AppCard: React.FC<AppCardProps> = ({ 
  children, 
  className = '', 
  variant = 'default',
  as: Component = 'div'
}) => {
  const variantStyles = {
    default: 'shadow-sm',
    elevated: 'shadow-md ring-1 ring-black/5 dark:ring-white/5'
  };

  return (
    <Component 
      className={`bg-white dark:bg-slate-800 rounded-[24px] border border-[#EDF0F4] dark:border-slate-700 p-[20px] overflow-hidden ${variantStyles[variant]} ${className}`}
    >
      {children}
    </Component>
  );
};
