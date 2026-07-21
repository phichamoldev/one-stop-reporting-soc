# Root Cause Report (2026-07-21)

This document synthesizes the findings of the audit to definitively explain the series of system collapses experienced in the Backoffice panel today.

## Primary Root Cause
**React State Race Condition during Authentication Hydration**
The most severe failure was an infinite redirect loop and immediate session termination upon login. This occurred because `StaffAuthContext` managed the synchronization of the `profile` object (fetched asynchronously via SWR) into a React `useState` via a `useEffect`. This architecture inherently created a one-render-cycle delay. During this microscopic gap, the user was authenticated (`user` was truthy), but the profile was still technically `null`. The `login/page.tsx` component observed this transitional state, falsely concluded the user lacked privileges, and immediately executed a `signOut()` command.

## Secondary Root Cause
**Proxy/Antivirus Header Stripping**
Prior to the race condition manifesting fully, users experienced random `401 Unauthorized` errors. The investigation revealed that certain network environments (proxies or antivirus software) were stripping the `Authorization: Bearer` header from outgoing API requests. Because the protected API routes solely relied on headers, they threw authentication errors, which then triggered the client to forcefully destroy the session.

## Chain Reaction Analysis
1. **The Catalyst**: A user attempts to log in.
2. **The Sync Gap**: `signInWithPassword` succeeds. The `user` object populates immediately via the realtime auth listener. However, `profile` takes a few milliseconds to fetch via SWR and another render cycle to sync via `useEffect`.
3. **The False Positive**: `login/page.tsx` checks `if (user && !profile)`. It hits this condition during the sync gap.
4. **The Execution**: `login/page.tsx` calls `signOut()`. The session is erased from LocalStorage.
5. **The Cascade**: The previously initiated SWR network requests (for Dashboard data, Pending Summary, and even the Profile itself) execute. Because the session was just erased, `fetcherWithAuth` fails to append the JWT token.
6. **The Fallout**: The API routes receive requests with no tokens, throwing `401 Unauthorized`. The browser console floods with red network errors, and the user is thrown violently back to the login screen, creating an infinite, unresolvable loop.

## Files Involved
- `app/backoffice/login/page.tsx` (Triggered the false `signOut`)
- `src/contexts/StaffAuthContext.tsx` (Housed the async `useEffect` sync gap)
- `src/lib/fetcher.ts` (Failed silently when session disappeared)
- `app/api/backoffice/dashboard/route.ts` (Threw the final 401s)
- `src/lib/auth-helpers.ts` (Where the fix was applied to handle stripped headers)

## Risk Assessment
The combination of these issues posed a **Critical Risk** (Severity: High, Probability: High), completely halting administrative operations. The underlying architecture was sound, but the fragility of async React state synchronization interacting with aggressive security assertions (forced logouts) proved catastrophic.
