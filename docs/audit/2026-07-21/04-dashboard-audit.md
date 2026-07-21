# Dashboard Audit (2026-07-21)

This document audits the Backoffice Dashboard ecosystem, focusing on state management, data fetching, and component synchronization.

## Architecture Map

```text
DashboardProvider (React Context + SWR)
 ├── DashboardKPIs (Consumes Context)
 ├── DashboardCharts (Consumes Context)
 └── DashboardRecentReports (Consumes Context)
```

## Audit Findings

### 1. DashboardProvider & SWR
- **Implementation**: The dashboard data is fetched centrally in `DashboardContext.tsx` using `useSWR`. The fetched `data`, `isLoading`, and `error` states are provided via React Context to child components.
- **Optimization**: SWR is configured with a `dedupingInterval: 60000` (1 minute). This correctly prevents duplicate network requests if multiple components mount simultaneously.
- **Null Data Handling**: If `user` or `profile` is unavailable, or if the user lacks the proper role, the SWR key is set to `null`, correctly pausing the fetch.

### 2. Child Components (KPIs, Charts, Recent Reports)
- **Hook Order Violation (Fixed)**: Previously, child components contained early returns (`if (isLoading) return <Skeleton />`) before calling React hooks. This React hook order violation was fixed today. All hooks are now correctly positioned at the top of the functional components.
- **Undefined/Null Data**: Child components handle `isLoading || !data` gracefully by rendering skeleton loaders.

### 3. Realtime Listener
- **Implementation**: `RealtimeListener.tsx` runs globally (outside `AuthGuard`) but conditionally executes based on `user` presence. It listens to Supabase Postgres changes.
- **Invalidation**: Upon receiving a database payload, it calls `mutate()` on relevant SWR keys. This effectively invalidates the stale cache and triggers a background re-fetch, keeping the dashboard live without infinite polling.
- **Risk**: If the SWR keys managed by `RealtimeListener` drift from the keys used in `DashboardProvider` (e.g., due to dynamic query parameters like `dateRange`), the realtime invalidation will fail silently.

### 4. API Endpoints
- **Implementation**: `/api/backoffice/dashboard/route.ts` aggregates data using `supabaseAdmin`.
- **Loading Deadlocks**: The most recent loading deadlock was caused by the Authentication Race Condition (detailed in `03-auth-audit.md`), where the SWR request was sent with a null session, returning a 401 and leaving the dashboard in a perpetual error/loading state.
- **Performance**: The API endpoint aggregates large amounts of data server-side. For massive datasets, this could eventually become a bottleneck, but for the current scale, it is optimal.

## Conclusion
The Dashboard architecture is solid. The combination of SWR caching and Context provider prevents duplicate requests effectively. The recent fixes addressed the critical hook order violations and the authentication cascade that was breaking the data layer.
