# API_DUPLICATION_AUDIT.md

## Overview
An audit of all API requests made during the initial load of the Backoffice dashboard (`/backoffice`) reveals several inefficiencies, overlapping fetches, and anti-patterns in data fetching using SWR.

---

## 1. Unnecessary API Calls (Over-fetching Overlap)

- **Component:** `DashboardProvider` and `RealtimeListener`
- **File:** `src/contexts/DashboardContext.tsx` and `src/components/backoffice/RealtimeListener.tsx`
- **Why it happens:** 
  During page load, `DashboardProvider` fires an SWR request to `/api/backoffice/dashboard?dateRange=7days` to get KPIs, analytics, and **recent reports**. Simultaneously, `RealtimeListener` (which is mounted in the global layout wrapper) fires a request to `/api/backoffice/pending-summary` to fetch the top 7 pending **reports** for notifications. Both queries overlap significantly by querying the `reports` table concurrently.
- **Intentional?** 
  Yes. The `RealtimeListener` needs to run on *every* backoffice page (not just the dashboard) to provide global notifications, hence it has its own dedicated fetch.

---

## 2. Re-render Triggered Request Cancellation (SWR Anti-Pattern)

- **Component:** `RealtimeListener`
- **Hook:** `useSWR`
- **File:** `src/components/backoffice/RealtimeListener.tsx`
- **Why it happens:** 
  The component defines its SWR key based on a ref: 
  ```typescript
  const { data } = useSWR(user && !hasFetchedInitial.current ? '/api/backoffice/pending-summary' : null, ...)
  ```
  Once the data is successfully fetched, a `useEffect` runs and sets `hasFetchedInitial.current = true`. This triggers a re-render where the SWR key becomes `null`. Setting an SWR key to `null` forces the hook to drop its cache binding and return `undefined`, essentially throwing away the fetched data and un-subscribing.
- **Intentional?** 
  Yes, but poorly executed. The developer intended a "fetch once on mount, then let Supabase WebSockets handle the rest" pattern. However, manipulating the SWR key to `null` after a successful fetch is a React anti-pattern that leads to unnecessary re-renders.

---

## 3. Repeated Fetches / Premature SWR Preloading

- **Component:** `BackofficeSidebar`
- **Hook:** `preload` (from `swr`)
- **File:** `src/components/backoffice/BackofficeSidebar.tsx`
- **Why it happens:** 
  The sidebar uses an `onMouseEnter` event with a 200ms timeout to aggressively `preload` API data when the user hovers over navigation links. For example, hovering over "จัดการคำร้อง" (Reports) triggers a fetch to `/api/backoffice/dashboard?dateRange=all`. If the cache is empty, this causes background API requests simply by moving the mouse across the sidebar, even if the user doesn't click.
- **Intentional?** 
  Yes. This is an intentional UX optimization to make page transitions feel instantaneous. However, it can cause unnecessary server load if the user is just moving their mouse around.

---

## 4. Heavy Endpoint Reuse (Over-fetching)

- **Component:** `BackofficeReportsPage`
- **File:** `app/backoffice/reports/page.tsx`
- **Why it happens:** 
  When navigating to the Reports page, the component calls `/api/backoffice/dashboard?dateRange=all`. It reuses the heavy Dashboard API (which calculates complex analytics, KPIs, and aggregations) *only* to extract the `reports` array. The analytics and KPI data are completely ignored by the Reports view.
- **Intentional?** 
  Yes. It was likely done to reuse existing backend filtering logic (since the dashboard API already handles `search`, `status`, `category` query params), but it places an unnecessary analytical burden on the database.

---

## Conclusion
While there are no catastrophic infinite loops, the combination of global layout fetches overlapping with page-level fetches, aggressive sidebar preloading, and SWR cache key manipulation creates unnecessary database queries and React render cycles. 

**DO NOT OPTIMIZE YET.** (As per instructions).
