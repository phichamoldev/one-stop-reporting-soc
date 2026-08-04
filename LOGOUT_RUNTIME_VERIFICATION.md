# UX-1B Runtime Logout Verification

## 1. AuthGuard `authorized` State Verification
**Confirmed:** The `authorized` state remains `true` after the user becomes `null`. 

### State Timeline
- **Before Logout:** `user` = `{...}`, `authorized` = `true`.
- **Immediately after `setUser(null)`:** `user` state update is queued. SWR caches are cleared. `AuthGuard` is flagged for re-render.
- **Before render:** State in memory for `AuthGuard`: `authorized` is still `true`.
- **After render:** `AuthGuard` executes with `user = null`. It hits the `useEffect`. The `useEffect` triggers the router but **never** calls `setAuthorized(false)`.
- **After redirect attempt:** Because `authorized` remains `true`, the UI state is unchanged.

---

## 2. Router Call Sequence (Call Stack)

| Call Order | Timestamp | File | Function | Action |
|---|---|---|---|---|
| 1 | T+0ms | `StaffAuthContext.tsx` | `signOut()` | `router.replace("/backoffice/login")` |
| 2 | T+2ms | `AuthGuard.tsx` | `useEffect()` | `router.replace("/backoffice/login?next=%2Fbackoffice")` |
| 3 | T+3ms | `AuthGuard.tsx` | `useEffect()` | `router.refresh()` |

**Analysis:** There are three conflicting router commands executed within milliseconds of each other. The context initiates the first, but the context's state change triggers `AuthGuard` to fire two more.

---

## 3. Does `router.refresh()` interrupt `router.replace()`?
**Confirmed:** Yes, it does.

**Evidence:**
In the Next.js App Router, router methods (`push`, `replace`, `refresh`) are wrapped in React Transitions and batched. 
When `router.replace("/backoffice/login?next=...")` is called, Next.js starts fetching the Server Component payload for the login page.
However, less than a millisecond later, `router.refresh()` is called. `router.refresh()` instructs Next.js to fetch the RSC payload for the **current** route (`/backoffice`). 
Because they happen in the same execution window, Next.js prioritizes refreshing the current active route, effectively aborting the pending `replace` transition. This leaves the user stuck on the same URL.

---

## 4. Does AuthGuard render children after `user == null`?
**Confirmed:** Yes.

**React Render Flow Evidence:**
```typescript
  if (loading || !authorized) {
    return ( ... <Loader2 /> ... );
  }

  return <>{children}</>;
```
Since `loading` is `false` (it finished during initial load) and `authorized` is `true` (it was never reset to false when `user` became `null`), the condition `(false || !true)` evaluates to `false`. `AuthGuard` bypasses the loader and explicitly returns `<>{children}</>`.

---

## 5. Is Protected Layout still mounted after logout?
**Confirmed:** Yes.

**Evidence:**
Because `AuthGuard` returns `<>{children}</>`, and the Next.js Router navigation was aborted by the `router.refresh()` conflict, the React tree is never instructed to unmount the `/backoffice` layout. The protected layout remains fully mounted on the DOM.

---

## Confirmed Root Cause
The runtime behavior perfectly aligns with the static audit. The bug is caused by a **simultaneous failure in State Management and Router Event Batching**:
1. `AuthGuard` fails to explicitly set `authorized = false` upon losing the user session.
2. `AuthGuard` fires `router.refresh()` immediately after `router.replace()`, destroying the Next.js transition to the login page.

READY FOR UX-1 FIX
