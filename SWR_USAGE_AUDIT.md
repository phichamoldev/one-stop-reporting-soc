# PRE-PHASE 4 — SWR USAGE AUDIT

## 1. Complete SWR Inventory

| File Path | Component / Hook | SWR APIs Used | Purpose |
|---|---|---|---|
| `src/contexts/StaffAuthContext.tsx` | `StaffAuthProvider` | `useSWR`, `useSWRConfig` (`mutate`) | Authentication (Profile Loading) |
| `src/hooks/usePublicStaffAuth.ts` | `usePublicStaffAuth` | `useSWR` | Authentication (Legacy Profile Loading) |
| `src/contexts/DashboardContext.tsx` | `DashboardProvider` | `useSWR` | Dashboard KPI |
| `src/components/backoffice/RealtimeListener.tsx` | `RealtimeListener` | `useSWR`, `useSWRConfig` (`mutate`) | Notifications & Realtime cache invalidation |
| `src/components/backoffice/ReportDetailView.tsx` | `ReportDetailView` | `useSWR`, `mutate` | Reports & Departments |
| `src/components/backoffice/BackofficeSidebar.tsx` | `BackofficeSidebar` | `preload`, `useSWRConfig` (`cache`) | Preloading (Dashboard, Reports, Analytics) on hover |

---

## 2. Authentication Dependency Graph (Special Attention)

**Analysis of `src/contexts/StaffAuthContext.tsx`:**
- **Is SWR used only for profile loading?**
  Yes. It is solely used to fetch `/api/staff/profile?v=2`. SWR does not handle the Supabase session token itself.
- **Does authentication depend on SWR state?**
  Yes. The V2 deterministic state machine explicitly reads SWR's `profileLoading`, `profileError`, and `profileData` to determine if `status` becomes `'authenticated'`, `'loading'`, or `'forbidden'`.
- **Does logout call `mutate()`?**
  Yes. `signOut` calls `mutate("/api/staff/profile?v=2", undefined, { revalidate: false })` to wipe the profile from the SWR cache.
- **Does `dedupingInterval` affect authentication?**
  Yes. It is set to `300000` (5 minutes). This prevents a legitimate network request when logging in again shortly after logout, trapping the user in the artificially mutated `undefined` cache state.
- **Does profile cache survive logout?**
  Yes. The global SWR memory cache survives until a hard browser refresh (F5). It retains the mutated `undefined` state, causing the next login to instantly fail.

---

## 3. Profile API Dependency Graph (`/api/staff/profile`)

The endpoint `/api/staff/profile` is consumed exclusively by:
1. `src/contexts/StaffAuthContext.tsx` (Backoffice Authentication)
2. `src/hooks/usePublicStaffAuth.ts` (Public/Legacy Authentication Hook)
3. `tests/e2e/qa-full-suite.spec.ts` (E2E Tests)

It is **NOT** consumed by the Dashboard, Reports, AuthGuard, or Login Page directly (they consume the Context instead).

---

## 4. Safe Removal Assessment

| File Path | Safe to Remove? | Reason |
|---|---|---|
| `src/contexts/StaffAuthContext.tsx` | **SAFE** | SWR introduces aggressive caching and deduping that actively conflicts with the Supabase session lifecycle. Replacing it with standard `fetch` + `useEffect` guarantees synchronization. |
| `src/hooks/usePublicStaffAuth.ts` | **DO NOT TOUCH** | Legacy hook; out of scope for Phase 4. |
| `src/contexts/DashboardContext.tsx` | **DO NOT TOUCH** | SWR is perfectly suited for dashboard data caching. |
| `src/components/backoffice/RealtimeListener.tsx` | **DO NOT TOUCH** | Uses SWR to trigger UI updates without full reloads. |
| `src/components/backoffice/ReportDetailView.tsx` | **DO NOT TOUCH** | Relies on SWR for cache invalidation and UI reactivity. |
| `src/components/backoffice/BackofficeSidebar.tsx` | **DO NOT TOUCH** | Uses SWR `preload` to optimize perceived performance. |

**Impact of Removing SWR from `StaffAuthContext.tsx` Only:**
- **Dashboard**: NO impact (Maintains its own SWR cache)
- **Reports**: NO impact (Maintains its own SWR cache)
- **Analytics**: NO impact
- **Notifications**: NO impact
- **Categories**: NO impact
- **Departments**: NO impact
- **Realtime**: NO impact
- **Settings**: NO impact

---

## 5. Recommendation

**B. Remove SWR only from Authentication**

**Justification**: SWR is an incredible tool for data fetching, caching, and reactivity (which is why it should remain in Dashboard, Reports, and Sidebar). However, Authentication state must be perfectly synchronized with the Supabase session at all times. SWR's features (`dedupingInterval`, cache survival, `mutate(undefined)`) actively fight against the Auth lifecycle, creating semantic mismatches that cause the "profile not found" bug. By swapping SWR for a standard `fetch` inside `StaffAuthContext`, we regain 100% control over the profile lifecycle without impacting any downstream UI caches.
