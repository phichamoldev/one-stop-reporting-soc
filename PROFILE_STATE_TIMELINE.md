# PROFILE STATE TIMELINE AUDIT

## Trace: `profile` state across the lifecycle

1. **Initial Login**
   - `undefined` / `null` (User has no session initially).
   - `null` (Session found, SWR begins fetching, `profileData` is undefined).
   - `object` (SWR completes, `profileData.profile` is populated).

2. **Logout**
   - `object` (Before logout).
   - `null` (Synchronously becomes null the exact moment `setUser(null)` is called).
   - *Note*: SWR cache is explicitly mutated to `undefined` via `mutate(..., undefined, { revalidate: false })`.

3. **Login Again (Without F5)**
   - `null` (User session is restored).
   - SWR evaluates the cache for `"/api/staff/profile?v=2"`. Because it was explicitly mutated to `undefined` during logout, and/or because of the `dedupingInterval: 300000` blocking a re-fetch, SWR immediately returns `isLoading: false` and `data: undefined`.
   - `null` (Remains null because `profileData` is undefined and SWR is not loading it).

---

## Answers to Audit Questions

### 1. When exactly is profile initialized?
`profile` is derived synchronously via a `useMemo` in `StaffAuthContext`. It becomes a valid object only after `user` is truthy and SWR successfully returns `profileData.profile`.

### 2. When exactly is profile set to null?
It is set to `null` the exact moment `user` becomes null (e.g., during `signOut`), or if `profileData` lacks a `profile` object (e.g., when the SWR cache is wiped or returns a 403).

### 3. Can profile temporarily become null while `status == authenticated`?
**No**. The V2 state machine strictly prevents this. For `status` to equal `'authenticated'`, it must pass the `if (!profile) return 'forbidden';` check. Thus, `profile` is guaranteed to be truthy whenever `status === 'authenticated'`.

### 4. Can Login page read profile before StaffAuthProvider finishes publishing it?
**Yes**, but only because of a semantic mismatch caused by the SWR cache manipulation. When the user logs in a second time, SWR's cache memory tricks it into returning `isLoading: false` and `data: undefined`. 
Because `profileLoading` is false and `profile` is null, the state machine evaluates to `status = 'forbidden'`. 
Because `status` is `'forbidden'`, the V1 compatibility mapping sets `profileResolved = true`. 
The Login page effect then executes because `profileResolved` is true, effectively reading a `null` profile *before* a real network request was ever made.

### 5. Who creates "บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบ" exactly?
The `useEffect` block inside `app/backoffice/login/page.tsx` generates this error string locally. It fires the `else` branch when `user` is truthy, `profileResolved` is true (due to the false `forbidden` status), but `profile` is null.

### 6. Why does F5 immediately fix it?
Pressing F5 performs a hard refresh of the browser window. This destroys the JavaScript heap, entirely clearing the global SWR cache, removing the lingering `undefined` mutation, and bypassing the `dedupingInterval`. Upon reload, SWR correctly starts with a completely fresh state, correctly setting `isLoading: true`. The state machine accurately outputs `loading`, and the Login page waits for the network request to finish and return the valid profile.
