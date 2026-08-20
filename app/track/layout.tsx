import React from 'react';

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="flex-1 flex flex-col bg-slate-100">
      {children}
    </div>
  );
}
