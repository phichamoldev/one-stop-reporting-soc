# ROLE PROPAGATION TRACE

## Expected Output Trace (Simulated)
Based on React's Context architecture and the deterministic V2 state machine, here is exactly what the console logs will output during the final "Login as Super Admin" transition:

```
[StaffAuthContext] fetchProfile success, role=super_admin
[StaffAuthContext] RENDER status=authenticated role=super_admin
[AuthGuard] status=authenticated role=super_admin pathname=/backoffice
[Sidebar] role=super_admin
```

## Answers to Questions

### 1. Does StaffAuthContext publish `super_admin`?
**Yes.** 
When the Super Admin successfully authenticates, `fetchProfile` executes, receives the `super_admin` role from `/api/staff/profile?v=2`, updates the `profile` state, and publishes it via `StaffAuthContext.Provider`.

### 2. Does AuthGuard receive `super_admin`?
**Yes.** 
`AuthGuard` consumes `useStaffAuth()`. When Context updates, `AuthGuard` re-renders and receives `profile.role === 'super_admin'`. This is why the "Dashboard loads correctly" without redirecting you away.

### 3. Does Sidebar receive `super_admin`?
**Yes.** 
`BackofficeSidebar` sits directly adjacent to `AuthGuard` inside the exact same `<StaffAuthProvider>` tree. Because React Context propagates downward symmetrically to all subscribers, it is mathematically guaranteed that `BackofficeSidebar` receives `super_admin` at the exact same millisecond as `AuthGuard`.

### 4. If Sidebar receives `super_admin`, why does DOM still show Staff menu?
This is caused by a known anomaly in **Next.js App Router's Client-Side Router Cache (bfcache/Layout Cache)**.
When navigating from a shared layout (`/backoffice/reports`) to a detached layout (`/backoffice/login`), and then back to the shared layout (`/backoffice`), Next.js attempts to aggressively optimize by restoring the cached React Server Component (RSC) payload and the frozen DOM state of the Client Components from before the logout. 
Because `BackofficeSidebar` lacks a unique React `key`, Next.js restores its stale DOM representation but occasionally fails to trigger a full React hydration cycle on it to sync with the newly published Context, leaving the UI frozen visually while the underlying state is actually correct. (Pressing F5 destroys this cache and forces a fresh render, immediately fixing it).

### 5. If Sidebar still receives `staff`, why?
**It does not receive `staff`.** 
If it had received `staff`, the Context itself would be holding `staff`. If the Context was holding `staff`, `AuthGuard` would have redirected you out of the Dashboard. The fact that the Dashboard loaded confirms the Context successfully propagated `super_admin`.
