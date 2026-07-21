# Recovery Plan (2026-07-21)

This document outlines the theoretical steps required to recover the system from the identified root causes. *(Note: These steps have largely been executed during the emergency response, but are formalized here for the audit record).*

## Step 1: Mitigate the Proxy Header Stripping
- **Action**: Modify the SWR `fetcherWithAuth` to append the JWT as a URL query parameter (`?token=`) in addition to sending it via the `Authorization` header.
- **Action**: Create a `verifyAuthToken` backend helper that checks both the `authorization` header and the `token` URL search parameter.
- **Estimated Impact**: High. Immediately resolves 401 errors for users on restrictive enterprise networks or aggressive antivirus proxies. Zero risk of regression.

## Step 2: Resolve the React Hook Sync Gap
- **Action**: Refactor `StaffAuthContext.tsx` to eliminate the `useEffect` that synchronizes `profileData` to the `profile` state.
- **Action**: Implement `useMemo` to synchronously derive the `profile` object directly from the SWR data payload during the same render cycle.
- **Estimated Impact**: Critical. This completely eliminates the one-render gap where `user` exists but `profile` is null, preventing the `login/page.tsx` component from executing a false `signOut()`.

## Step 3: Secure Profile Fetching (Bypass RLS)
- **Action**: Update `app/api/staff/profile/route.ts` to utilize the `supabaseAdmin` service role key rather than the client JWT when querying the `staff_users` table.
- **Action**: Ensure this is securely gated by first proving the user's identity via `verifyAuthToken`.
- **Estimated Impact**: High. Prevents the database Row Level Security policies from blocking legitimate staff members from retrieving their own authorization profiles.

## Step 4: Stabilize Layout Transitions
- **Action**: Relocate `StaffAuthProvider` from inside the conditional layout branches into the root `BackofficeLayoutWrapper`.
- **Estimated Impact**: Medium. Prevents the Context Provider from unmounting and remounting when a user transitions from `/backoffice/login` to `/backoffice`. This preserves SWR cache and prevents aggressive re-fetching.

## Step 5: Clean Up Error Handling
- **Action**: Ensure API endpoints return consistent JSON error objects, and that client components (like `/track/[publicId]/page.tsx`) do not attempt to render these objects directly into the React DOM.
- **Estimated Impact**: Low to Medium. Prevents application crashes (white screens of death) when edge-case errors occur.
