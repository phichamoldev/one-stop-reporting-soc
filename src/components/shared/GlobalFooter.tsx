import React from 'react';
import Link from 'next/link';

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.85 10.91.57.1.78-.25.78-.56v-2.16c-3.19.69-3.86-1.54-3.86-1.54-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.52-2.55-.29-5.23-1.27-5.23-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.17a10.9 10.9 0 0 1 5.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.59.23 2.76.11 3.05.73.8 1.18 1.82 1.18 3.07 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.04.77 2.1v3.12c0 .31.2.67.79.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"></path>
          </svg>
  );
}

export function GlobalFooter() {
  return (
    <footer className="w-full border-t border-[#EDF0F4] dark:border-slate-800 pt-4 pb-6 flex flex-col items-center justify-center text-[10px] text-slate-500 dark:text-slate-400 shrink-0 bg-transparent">
      <div className="text-center">
        <p>© 2026 Faculty of Social Sciences, Kasetsart University</p>
        <p className="mt-1 flex items-center justify-center gap-1">
          Version 1.0.0 |  Developed by 
          <Link 
            href="https://github.com/phichamoldev" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
             <GithubIcon size={14} />
            @phichamoldev
           
          </Link>
        </p>
      </div>
    </footer>
  );
}
