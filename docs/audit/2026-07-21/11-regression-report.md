# Regression Audit (2026-07-21)

This document compares the recent optimizations against the architectural baseline to identify which specific changes caused the cascading failures in the Backoffice panel today.

## Optimization Suspects

### 1. `StaffAuthProvider` React Hook Sync (99% Confidence)
- **What was changed**: During a push to eliminate "slow loading" and "infinite redirect loops," the management of the `profile` state within `StaffAuthContext.tsx` was heavily modified using `useEffect`.
- **How it broke the Admin**: The `useEffect` introduced an asynchronous one-render delay. `login/page.tsx` was optimized to execute a forced `signOut()` if a user was authenticated but lacked a profile. The one-render delay triggered this forced logout instantly upon every successful login, effectively locking all users out of the system.
- **Verdict**: **PRIMARY CAUSE**.

### 2. SWR Fetch Caching (`no-store` and `dedupingInterval`) (85% Confidence)
- **What was changed**: `cache: 'no-store'` was added to the native `fetch` call inside `fetcherWithAuth`, and `dedupingInterval: 300000` was added to the profile SWR hook.
- **How it broke the Admin**: While `no-store` correctly bypassed Next.js's aggressive server cache (preventing stale 401s), the combination of this with the `signOut()` bug above meant that when the session was destroyed, the SWR cache either held onto dead data or immediately re-fetched without a token, flooding the logs with 401 errors.
- **Verdict**: **SECONDARY CAUSE / AGGRAVATOR**.

### 3. RLS Bypass via `supabaseAdmin` (60% Confidence)
- **What was changed**: Moved from `supabaseClient.auth.getUser()` to `supabaseAdmin` for backend profile fetching.
- **How it broke the Admin**: Initially, utilizing `supabaseAdmin` blindly without proper JWT verification allowed the API to work, but it was insecure. When `verifyAuthToken` was introduced to fix the security gap, it exposed the fact that the underlying JWT was actually missing/stripped by the client's proxy.
- **Verdict**: **EXPOSED EXISTING FLAW**.

### 4. Layout Provider Repositioning (10% Confidence)
- **What was changed**: Moved `StaffAuthProvider` from inside conditional logic to the root of `BackofficeLayoutWrapper`.
- **How it broke the Admin**: It didn't. This was a necessary and correct optimization to prevent the entire authentication context from unmounting and losing state during route transitions.
- **Verdict**: **INNOCENT**.

### 5. Realtime Listener (5% Confidence)
- **What was changed**: Connected Supabase realtime events to SWR `mutate()`.
- **How it broke the Admin**: It didn't. However, it was a victim of the Primary Cause; when the session was destroyed, the Realtime Listener attempted to fetch `/api/backoffice/pending-summary` without a token, resulting in the visible 401 errors in the console.
- **Verdict**: **INNOCENT VICTIM**.
