# Import Audit & Risk Matrix (2026-07-21)

This document covers the Phase 7 Import Audit and maps the current architectural risks.

## Import Audit

### Findings
- **Missing Imports (Fixed)**: Previously today, `app/api/staff/profile/route.ts` was missing the `createClient` import from `@supabase/supabase-js`, which caused a 500 error. This was resolved in commit `9272743`.
- **Circular Dependencies**: None detected in the standard module resolution tree.
- **Incorrect Aliases**: The project successfully and consistently uses the `@/` path alias for `src/`.
- **Unused Imports**: Standard IDE linting appears to have kept unused imports to a minimum. 
- **Barrel Exports**: No excessive barrel files (`index.ts`) were found that would cause tree-shaking issues or circular dependency warnings.

## Architectural Risk Matrix

| Component / Subsystem | Risk Level | Description | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Authentication Sync** | Low (was Critical) | React state (`useState`) lagging behind SWR fetches caused false logouts. | Replaced with synchronous `useMemo` derivation. Ensure future global states avoid async `useEffect` syncs. |
| **Proxy Header Stripping** | Low | Corporate firewalls modifying HTTP headers causing 401s. | Implemented dual-token transmission (Header + URL Query). |
| **API Rate Limiting** | Medium | Dashboard widgets hitting API routes heavily on refresh. | `dedupingInterval` added to SWR. `supabaseAdmin` used on backend to bypass restrictive Supabase user rate limits for internal staff tools. |
| **Realtime Stale Cache** | Low | SWR cache going out of sync with Database. | `RealtimeListener` implemented to intelligently invalidate SWR keys via `mutate()` upon Postgres row changes. |
| **Hydration Mismatches** | Low (was Medium) | SSR rendering differing from CSR due to window/localStorage usage. | Disabled SSR for charting components (`DashboardCharts`) and ensured `AuthGuard` handles loading states safely. |
| **RLS Collisions** | Medium | Row Level Security policies blocking valid staff operations. | Use of `supabaseAdmin` in protected API routes, manually enforcing `department_id` segregation instead of relying on Postgres RLS. |
