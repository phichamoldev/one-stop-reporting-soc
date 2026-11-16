import React from "react";

/**
 * Single source of truth for central content width constraint.
 * Change this value (e.g. max-w-[1280px] or max-w-[1360px]) to adjust
 * the width across all matching pages and their navbars.
 */
export const PAGE_SHELL_MAX_WIDTH = "max-w-[1280px]";

/**
 * Common container class:
 * mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8
 */
export const PAGE_SHELL_CONTAINER_CLASS = `mx-auto w-full ${PAGE_SHELL_MAX_WIDTH} px-4 sm:px-6 lg:px-8`;

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  as?: "main" | "div";
}

/**
 * Central wrapper component for page content.
 * Keeps content width capped at max-w-[1280px] and centered with balanced
 * left/right margins on wide screens, matching the header logo and search icon edges.
 */
export const PageShell: React.FC<PageShellProps> = ({
  children,
  className = "",
  as = "main",
}) => {
  const Component = as;
  return (
    <Component
      className={`mx-auto w-full ${PAGE_SHELL_MAX_WIDTH} px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 flex-1 flex flex-col min-w-0 ${className}`}
    >
      {children}
    </Component>
  );
};

