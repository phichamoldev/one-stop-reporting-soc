# Authentication Audit (2026-07-21)

This document traces the authentication flow and identifies potential or historical points of failure in the system.

## Login Flow Trace

```text
login (app/backoffice/login/page.tsx)
  ↓
Supabase Auth (signInWithPassword in StaffAuthContext)
  ↓
session (Saved to LocalStorage, picked up by onAuthStateChange)
  ↓
fetcherWithAuth (Appends token to query params to bypass proxy/antivirus stripping)
  ↓
API /api/staff/profile (Validates token using verifyAuthToken)
  ↓
profile (Fetched from `staff_users` table using supabaseAdmin to bypass RLS)
  ↓
StaffAuthContext (Synchronously derives profile from SWR data via useMemo)
  ↓
AuthGuard (Evaluates user and profile existence)
  ↓
role & permission (Checked via hasAccess(profile.role, pathname))
  ↓
layout / page (Renders protected children if authorized)
  ↓
Protected API (e.g., /api/backoffice/dashboard calls verifyAuthToken & uses supabaseAdmin)
```

## Audit Findings

### 1. Missing Session / 401 Unauthorized
- **Root Cause**: The most prominent failure point was when APIs returned 401 errors. This occurred for two main reasons:
  1. Proxy/Antivirus software stripping `Authorization: Bearer` headers. 
     - *Status*: Resolved via `verifyAuthToken` which accepts tokens in both Headers and URL Query Parameters.
  2. SWR calling endpoints before `session` was established, or immediately after a forced `signOut()`.
     - *Status*: Resolved by ensuring robust token fallback logic and preventing erroneous `signOut` triggers.

### 2. Profile Race Condition (The React Hook Sync Issue)
- **Root Cause**: Previously, `StaffAuthContext` synced the SWR `profileData` to a React `useState` via a `useEffect`. This introduced a one-render-cycle delay where `user` was truthy, but `profile` was still `null`. `login/page.tsx` saw this state and mistakenly assumed the user lacked a profile, instantly executing `signOut()` and causing an infinite redirect loop and subsequent 401s from orphaned network requests.
- *Status*: Resolved. The profile is now synchronously derived using `useMemo`.

### 3. Row Level Security (RLS) Block / 403 Forbidden
- **Root Cause**: The `/api/staff/profile` route initially used the client's `supabase.auth.getUser()` token directly against the database, which was blocked by restrictive RLS policies on the `staff_users` table.
- *Status*: Resolved. The API route now uses `verifyAuthToken` to prove identity, and `supabaseAdmin` (Service Role Key) to bypass RLS and securely fetch the profile.

### 4. Hydration / SSR / CSR Mismatch
- **Root Cause**: `AuthGuard` is a Client Component, but it wraps Server-rendered layouts. During SSR, `user` and `profile` are unknown.
- *Status*: Next.js handles this by rendering the loading fallback initially on the client. `AuthGuard` currently transitions gracefully without hydration errors.

### 5. Duplicate Auth Checks
- **Root Cause**: Token validation is currently duplicated across every protected API route via the `verifyAuthToken` helper. 
- *Note*: While slightly repetitive, this is the intended and secure approach for Next.js App Router API routes when custom server-side validation is required.

## Conclusion
The authentication architecture is heavily reliant on client-side state propagation. The recent optimizations addressed the critical timing mismatches and proxy issues, stabilizing the flow.
