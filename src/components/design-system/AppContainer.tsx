import React from 'react';

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidthClass?: string;
}

export const AppContainer: React.FC<AppContainerProps> = ({ 
  children, 
  className = '',
  maxWidthClass = 'w-full'
}) => {
  return (
    <div className={`min-h-screen w-full bg-[#F4F6F8] dark:bg-slate-950 flex flex-col transition-colors duration-300 ${maxWidthClass} ${className}`}>
      {children}
    </div>
  );
};
