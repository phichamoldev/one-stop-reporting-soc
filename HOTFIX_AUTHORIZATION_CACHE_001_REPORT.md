# HOTFIX AUTHORIZATION CACHE-001 REPORT

## Objective
Prevent cross-session data leakage where a Staff user could instantly view an Admin's cached Dashboard and Reports data immediately following a logout/login sequence. 

## Implementation Details
Modified ONLY `src/contexts/DashboardContext.tsx` and `app/backoffice/reports/page.tsx`.

1. **Partitioned the SWR Key**
   - Transformed the `useSWR` string key into an Array-based key.
   - Inserted `user.id` into the cache key structure:
     `["/api/backoffice/dashboard", user.id, params.toString()]`
   - This mathematically isolates the SWR cache in memory for each distinct user. A Staff user and an Admin user now have completely separate cache buckets, even if they share the exact same browser tab and URL parameters.

2. **Adapted the Fetcher Inline**
   - Because `fetcherWithAuth` explicitly expects a single string URL, passing an SWR Array key would traditionally break the fetcher.
   - Rather than modifying the global fetcher or API routes, I implemented an inline adapter for the `useSWR` hook:
     `([url, id, queryString]: [string, string, string]) => fetcherWithAuth(\`${url}?${queryString}\`)`
   - This safely bridges the partitioned Array key back into a valid string URL for the underlying API request.

## Impact & Resolution
- **Data Leakage Eradicated**: Staff users can no longer reuse Admin caches. When Staff logs in, their unique `user.id` generates a brand new cache key, resulting in a mandatory cache miss and forcing a fresh, authorized network request to the server.
- **Global Cache Untouched**: The fix completely avoids destructive global operations like `mutate(() => true)`. Data remains safely cached per-user without forcefully wiping the memory store.

## Verification
- Modified only the two permitted files.
- `StaffAuthContext`, `AuthGuard`, `Login`, `Sidebar`, `Navbar`, and all API Routes remain untouched.
- `npm run build` executed and passed without any type errors or warnings.
- The changes have been successfully committed.
