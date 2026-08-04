# UX-1.2A — Router Transition Audit

## 1. Did `router.replace("/backoffice/login")` actually complete?
**No.** The navigation never completes, which is why the URL remains on `/backoffice` and the Login page is never shown.

## 2. If not, what interrupted it?
The Next.js router transition was interrupted by a conflicting router command. Specifically, `router.refresh()` was fired synchronously within the same render cycle as `router.replace()`, causing the router to discard the pending route change.

## 3. Is `router.refresh()` canceling `router.replace()`?
**Yes.** 
**Repository Evidence:**
When `StaffAuthContext.signOut()` sets `user` to `null`, `AuthGuard.tsx` re-renders and hits its `useEffect`:
```tsx
// Inside src/components/backoffice/AuthGuard.tsx
if (!user || !profile) {
    setAuthorized(false);
    const returnUrl = encodeURIComponent(pathname);
    router.replace(`/backoffice/login?next=${returnUrl}`); // Action A
    router.refresh(); // Action B
    return;
}
```
In the Next.js App Router architecture, router actions are wrapped in React Transitions and batched. Because **Action A** (navigate to `/login`) and **Action B** (refresh current route `/backoffice`) occur sequentially within milliseconds, Next.js prioritizes the `refresh` instruction for the current route, completely aborting the client-side navigation initiated by `replace()`.

## 4. What condition keeps `AuthGuard` inside the loading state?
The `AuthGuard` component explicitly renders a spinner based on two conditions:
```tsx
if (loading || !authorized) {
    return ( ... <Loader2 /> ... );
}
```
During Logout, the exact values are:
- `loading`: **false** (The initial context fetch is already finished).
- `user`: **null** (Cleared by `signOut`).
- `profile`: **null** (Derived from `user == null`).
- `authorized`: **false** (Successfully reset by our Phase 1.1 fix).

Because `!authorized` evaluates to `true`, `AuthGuard` is indefinitely locked into returning the spinner block.

## 5. Does the Login page ever mount?
**No.** Because the `router.replace` navigation was aborted by `router.refresh()`, the Next.js router never loads the React components for `/backoffice/login`. The DOM remains on the `/backoffice` layout.

## 6. Is App Router waiting for Server Components or Client Components?
**Neither.** 
The App Router is not "waiting" for anything. The `router.refresh()` command simply re-fetched the Server Components for the *current* route (which it likely completed in the background). However, because `AuthGuard` is a Client Component whose internal state (`authorized`) was hardcoded to `false` and never updated again, the client-side UI is stuck rendering the spinner. There are no pending transitions in progress.

## 7. Who owns the spinner?
**AuthGuard** owns this specific spinner.
- The `Loader2` component (from `lucide-react`) combined with `animate-spin text-primary` matches the exact JSX returned by `src/components/backoffice/AuthGuard.tsx` on line 51.
- It is NOT a React `<Suspense fallback={...}>` boundary.
- It is NOT the Layout or the Login page.

READY FOR UX-1.2 FIX
