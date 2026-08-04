# PERMISSION UI AUDIT

## Objective
Audit the Permission Rendering Layer (`BackofficeSidebar.tsx`, `BackofficeLayoutWrapper.tsx`, etc.) to determine the root cause of the stale sidebar menu after a role change.

---

## 1. Where is the sidebar menu generated?
The menu is generated directly inside the render body of `BackofficeSidebar.tsx` (around line 72). It defines an array of `menuItems` and instantly maps a `.filter()` over it.

## 2. Which value determines permission?
The `profile?.role` value extracted from `useStaffAuth()` determines permission. It is passed into the pure utility function `hasAccess(profile?.role, item.href)`.

## 3. Is the menu computed only once?
**No.** It is dynamically computed on **every single render** of `BackofficeSidebar`. There is no initialization barrier preventing re-computation.

## 4. Is `useMemo` used?
**No.** There is no `useMemo` caching the `menuItems` array. The array is re-created and re-filtered from scratch during every render cycle.

## 5. Does Sidebar re-render when `profile` changes?
**Yes.** `BackofficeSidebar` consumes the `useStaffAuth()` hook, which internally calls `useContext(StaffAuthContext)`. React guarantees that whenever the Context value updates, all consuming Client Components are forced to re-render.

## 6. Can menu remain stale after logout/login? Why?
**From a React Rendering perspective: NO.**
It is mathematically impossible for the React components themselves to cause this bug. 
- Both `AuthGuard` and `BackofficeSidebar` sit inside the exact same `<StaffAuthProvider>` in `BackofficeLayoutWrapper.tsx`.
- If a user logs in as Super Admin and the "Dashboard loads correctly", it definitively proves that `AuthGuard` read `profile.role === 'super_admin'` from the Context.
- Because `BackofficeSidebar` shares the identical Context reference, it must simultaneously receive `profile.role === 'super_admin'`. Since the menu is derived dynamically on every render without caching, it **must** render the Super Admin menu.

If the bug persists as described ("Sidebar still shows Staff menu"), it is a **Next.js Client-Side Router Cache (bfcache/Layout Cache) hydration issue**. Next.js preserves the DOM of shared layouts (like `<BackofficeSidebar>`) across navigations. If the router cache restores a stale React Server Component payload for the layout and fails to re-hydrate the Client Component properly against the new Context value, the DOM remains frozen on the old "Staff" state until a hard refresh (`F5`) forces a clean server render.

## 7. Is there any `useState(menu)` that initializes once and never updates?
**No.** There is absolutely no `useState` holding the menu array. It is entirely stateless and derived purely from the Context.

## 8. Which component owns the permission menu?
`BackofficeSidebar.tsx` exclusively owns and generates the desktop permission menu.
