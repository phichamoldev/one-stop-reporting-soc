import React from 'react';

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidthClass?: string;
}

export const AppContainer: React.FC<AppContainerProps> = ({ 
  children, 
  className = '',
  maxWidthClass = 'md:max-w-4xl'
}) => {
  return (
    <main className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-start md:py-12 transition-colors duration-300">
      <div className={`w-full max-w-md ${maxWidthClass} min-h-screen md:min-h-fit md:rounded-[32px] bg-slate-50 dark:bg-slate-900 md:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/50 dark:ring-white/10 overflow-hidden flex flex-col relative animate-scale-up ${className}`}>
        {children}
      </div>
    </main>
  );
};
