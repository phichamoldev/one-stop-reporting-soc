import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ 
  title, 
  description,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 ${className}`}>
      <span className="w-1.5 h-3.5 bg-primary rounded-full shrink-0"></span>
      <div className="pb-1 flex-1">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-none">{title}</h3>
        {description && (
          <span className="text-[10px] text-slate-500 font-medium block mt-1.5">{description}</span>
        )}
      </div>
    </div>
  );
};
