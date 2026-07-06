import React from 'react';

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const AppContainer: React.FC<AppContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <main className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center py-0 md:py-8 transition-colors duration-300">
      <div className={`w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[32px] bg-slate-50 dark:bg-slate-900 shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/50 dark:ring-white/10 overflow-hidden flex flex-col relative animate-scale-up ${className}`}>
        {children}
      </div>
    </main>
  );
};
