import React from 'react';
import Link from 'next/link';

export function PageHeader() {
  return (
    <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
      <Link
        href="/track/lookup"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors font-bold"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        ค้นหาใหม่
      </Link>
      <Link
        href="/"
        className="text-xs font-bold text-gray-500 hover:text-primary transition-colors"
      >
        หน้าหลัก
      </Link>
    </div>
  );
}
