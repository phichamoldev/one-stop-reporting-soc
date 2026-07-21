# Performance Audit (2026-07-21)

This document audits the rendering strategies, caching mechanisms, and overall performance bottlenecks within the Backoffice panel.

## Rendering Strategies

### 1. Server Components vs. Client Components
- **Client Components Heaviness**: The `/backoffice` segment heavily relies on Client Components (`"use client"`). `AuthGuard`, `BackofficeLayoutWrapper`, `DashboardProvider`, and virtually all UI components (Sidebar, Navbar, Widgets) are Client Components.
- **Impact**: This pushes a large JavaScript bundle to the browser and delays initial data fetching until hydration completes. While standard for highly interactive Admin SPAs, it negates some of the performance benefits of the Next.js App Router (RSC).
- **Optimization Applied**: `app/backoffice/page.tsx` now uses `next/dynamic` to dynamically import `DashboardKPIs`, `DashboardCharts`, and `DashboardRecentReports`. `DashboardCharts` explicitly disables SSR (`ssr: false`) to prevent hydration mismatches with charting libraries (e.g., Recharts) and to reduce initial Time To First Byte (TTFB).

## Caching & Data Fetching

### 1. SWR Cache Strategy
- SWR is heavily utilized for client-side data fetching.
- **`StaffAuthContext`**: Caches the user profile using `dedupingInterval: 300000` (5 minutes). This drastically reduces redundant API calls to `/api/staff/profile` when navigating between backoffice pages.
- **`DashboardContext`**: Caches aggregate dashboard data with `dedupingInterval: 60000` (1 minute). 
- **Fetch Fallback**: `cache: 'no-store'` is explicitly passed to the underlying `fetch` calls. This ensures that Next.js's aggressive server-side fetch cache does not interfere with SWR's client-side management, preventing stale 401s from being perpetually served.

### 2. Realtime Subscriptions
- `RealtimeListener.tsx` subscribes to the `reports` table.
- **Performance Benefit**: Instead of relying on aggressive short-polling via SWR, the realtime listener intelligently calls `mutate()` only when a relevant database change occurs. This is highly optimal and reduces both database load and client network traffic.

## Loading States

- **Dashboard Loading**: Uses bespoke Skeleton components while `DashboardContext` is resolving. Previously, an artificial 500ms delay was present in `ReportsView.tsx`, which was removed today to improve perceived performance.
- **Sidebar & Navbar Loading**: The `BackofficeSidebar` and `BackofficeNavbar` render immediately (optimistically) but may show skeleton placeholders internally if the `profile` object is still resolving.

## Deployment Topology
- **Vercel Region**: A `vercel.json` file was added to force Serverless Functions to deploy to `sin1` (Singapore). This minimizes latency for the target demographic and aligns API execution closer to the Supabase database region, reducing backend connection overhead.

## Conclusion
The application prioritizes SPA-like interactivity over strict Server-Side Generation. The combination of SWR deduping, dynamic imports, and Postgres realtime event listeners creates a highly responsive experience post-hydration. The removal of artificial delays and regional alignment via `vercel.json` represent significant performance wins today.
