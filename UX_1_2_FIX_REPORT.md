# UX_1_2_FIX_REPORT.md

## Fix Summary
Implemented the fix for the Next.js router transition conflict during the logout flow as directed in Phase UX-1.2.

- **Files Modified:** 
  - `src/contexts/StaffAuthContext.tsx`
  - `src/components/backoffice/AuthGuard.tsx`

## Why Duplicate Navigation Occurred
Both `StaffAuthContext` and `AuthGuard` were attempting to navigate the user to the login page during logout. 
When `StaffAuthContext.signOut()` set `user = null`, `AuthGuard` reacted to the state change and immediately triggered its own `router.replace` followed by `router.refresh()`. In Next.js App Router, these synchronous redundant transitions override each other, and `refresh()` causes the router to drop the navigation entirely, leaving the user permanently viewing the spinner on the protected route.

## Which Component Now Owns Navigation
**`StaffAuthContext`** is now the explicit, sole owner of the logout navigation flow.
- A new `isLoggingOut` module flag was exported from `StaffAuthContext`.
- During explicit logout, this flag is set to `true`.
- `AuthGuard` checks this flag; if true, it deliberately aborts its own router calls, preventing any competition with the primary logout transition.

## Why `router.refresh()` Was Removed
The `router.refresh()` in `AuthGuard` was permanently removed.
**Reason:** Next.js App Router automatically fetches the target layout and page (including server components) during a standard client-side `replace()`. Calling `refresh()` immediately after `replace()` is fundamentally flawed in this architecture as it instructs the router to fetch the *current* route payload and cancels the pending `replace` transition. It was completely unnecessary and was actively breaking direct-access unauthenticated redirects (such as passive session expiry). 

## Runtime Verification Results
- **Login:** Works perfectly. The `isLoggingOut` flag is correctly reset.
- **Logout:** Completes seamlessly. The user session clears, the UI transitions to a loader instantly, and the router cleanly lands on `/backoffice/login` without being aborted.
- **Direct Access / Passive Expiry:** If a user directly accesses `/backoffice` without a session, `AuthGuard` successfully triggers a clean `router.replace` without the conflicting `router.refresh()`.
- **Build Verification:** `npm run build` completed successfully with zero compilation or type errors.

READY FOR UX-1.3
