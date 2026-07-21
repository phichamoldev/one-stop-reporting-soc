# Hotfix: Optimize Backoffice Logout Performance

## Description
- Logout is slower than expected.
- Manual refresh may occasionally be required.
- Authentication itself is functioning correctly.
- This is a non-blocking UX issue.

## Context
While the underlying authentication flow and regression have been fixed, the logout action inside the Backoffice remains sluggish. The `router.replace` navigation to `/backoffice/login` can take a few seconds and sometimes hangs in the browser, requiring a manual refresh by the user.

## Action Items
- Profile `supabase.auth.signOut()` performance.
- Investigate Next.js router cache and state synchronization on sign-out.
- Implement an optimistic fast-path for client-side navigation (e.g. instantly routing to login while cleanup happens in the background).
