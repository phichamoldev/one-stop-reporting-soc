# AUTHORIZATION CACHE AUDIT

## Objective
Identify why the Dashboard and Reports page continue to display stale Admin data to a Staff user immediately after a role switch, despite the authentication context updating correctly.

---

### 1. Where are reports stored?
Reports are stored globally in the **client-side SWR Cache** memory structure. They are fetched via the `/api/backoffice/dashboard` endpoint and held in memory keyed by the URL string.

### 2. Is SWR cache preserved after logout?
**Yes.** SWR maintains its cache memory instance globally across the single-page application lifecycle. Logging out via `useStaffAuth().signOut()` clears the Supabase session and Context state, but it **does not** implicitly clear or mutate the SWR cache registry. The cached data remains fully intact in memory as long as the browser tab remains open.

### 3. Does DashboardProvider (and Reports Page) reset its state when user changes?
**No.** Both `DashboardProvider` (`src/contexts/DashboardContext.tsx`) and the Reports Page (`app/backoffice/reports/page.tsx`) rely strictly on `useSWR` for state management. `useSWR` only responds to the cache key it is provided; it has no concept of "who" the current user is unless you explicitly encode that identity into the key.

### 4. Does DashboardProvider use `user.id` or `role` in its SWR key?
**No.** 
In `DashboardContext.tsx`, the SWR key is defined as:
```typescript
user && profile && hasAccess(...) ? `/api/backoffice/dashboard?${params.toString()}` : null
```
In `reports/page.tsx`, the key is defined as:
```typescript
user ? `/api/backoffice/dashboard?${params.toString()}` : null
```
The key is strictly based on the API URL and query parameters. It completely omits any user-identifying data (`user.id` or `profile.role`).

### 5. Can Staff reuse Admin cache?
**Yes. This is the exact root cause of the bug.**
1. Admin logs in and loads reports. SWR caches 8 reports under the key `/api/backoffice/dashboard?dateRange=all`.
2. Admin logs out. SWR cache is untouched.
3. Staff logs in and navigates to the Reports page.
4. The component evaluates the SWR key. Because the URL parameters are identical, it generates the exact same string: `/api/backoffice/dashboard?dateRange=all`.
5. SWR sees a cache hit and **instantly returns the Admin's 8 reports** to the Staff user.
6. A hard refresh (`F5`) clears the browser memory (and thus the SWR cache), forcing a fresh network request that correctly returns 1 report.

### 6. Should DashboardProvider clear data when authenticated user changes?
Yes. To solve this securely, there are two standard approaches:
- **Approach A (Cache Busting):** Clear the SWR cache during the `signOut()` flow globally (e.g., `mutate(() => true, undefined, { revalidate: false })`).
- **Approach B (Key Partitioning - Recommended):** Embed the user's ID directly into the SWR key structure (e.g., `['/api/backoffice/dashboard', user.id, params.toString()]`). This permanently partitions the cache by user identity, making data leakage across sessions mathematically impossible even if the cache is never manually cleared.
