import React from 'react';

export default function BackofficeLoading() {
  return (
    <div className="flex-1 p-6 md:px-[50px] md:py-8 space-y-8 w-full min-h-screen">
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse">
        <div className="h-[360px] bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60" />
        <div className="h-[360px] bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60" />
      </div>
    </div>
  );
}
