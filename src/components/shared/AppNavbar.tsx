import React from 'react';
import Link from 'next/link';
import Image from "next/image";
import { PAGE_SHELL_MAX_WIDTH } from './PageShell';

interface AppNavbarProps {
  rightAction?: React.ReactNode;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({ rightAction }) => {
  return (
    <header className="w-full h-[72px] bg-white dark:bg-slate-900 border-b border-[#EDF0F4] dark:border-slate-800 sticky top-0 z-40">
      <div className={`mx-auto w-full ${PAGE_SHELL_MAX_WIDTH} px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between`}>
        {/* Left: Faculty Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-md bg-white p-1 flex items-center justify-center">
            <Image
              src="/images/ku-logo.png"
              alt="Kasetsart University"
              width={20}
              height={20}
              className="object-contain w-auto h-auto"
              priority
            />
          </div>
          <div>
            <span className="text-[12px] leading-none font-extrabold block text-black/80">คณะสังคมศาสตร์</span>
            <span className="text-[10px] leading-none text-slate-500 block uppercase tracking-wider font-semibold mt-0.5">Faculty of Social Sciences</span>
          </div>
        </Link>

        {/* Right: Custom Action or default Search Icon */}
        {rightAction !== undefined ? (
          rightAction
        ) : (
          <Link
            href="/track/lookup"
            className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            aria-label="ค้นหาปัญหา"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
};
