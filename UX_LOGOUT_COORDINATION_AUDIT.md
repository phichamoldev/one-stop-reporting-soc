# UX-1.2 Code Quality Audit

## 1. Implementation Mechanism
The `isLoggingOut` flag is implemented as a **Module Variable** (a mutable `export let` variable residing at the top level of the `StaffAuthContext.tsx` module). It is neither React state, nor a ref, nor part of the Context itself.

## 2. Evaluation

### React Correctness
**Poor.** Relying on mutable module variables for component synchronization is an anti-pattern in React. React's rendering engine does not track changes to module-level variables. This implementation only succeeds because the variable is mutated synchronously *right before* a React state update (`setUser(null)`), guaranteeing the updated boolean is ready in memory before `AuthGuard` starts its render cycle. 

### Concurrent Rendering Safety
**Unsafe.** If React 18+ Concurrent Mode pauses and resumes renders, or if multiple instances of the component tree exist in the same environment (such as during Server-Side Rendering, though these specific components are client-side), global/module variables can cause tearing and state leakage. The variable lives outside the React lifecycle.

### Multiple Browser Tabs
**Surprisingly Functional.** If the user has two tabs open and logs out in Tab A, `isLoggingOut` becomes `true` in Tab A. The session is cleared from local storage. Tab B's `onAuthStateChange` listener detects the session loss and sets `user = null`. Because `signOut()` was never called in Tab B, `isLoggingOut` remains `false` in Tab B's memory. Consequently, Tab B's `AuthGuard` successfully executes its own redirect to the login page. While brittle in theory, it actually produces the correct UX across tabs.

### Hot Reload
**Unsafe.** During development, Hot Module Replacement (HMR) routinely wipes and re-evaluates module-level variables. If `StaffAuthContext.tsx` is hot-reloaded, `isLoggingOut` resets to `false`, potentially causing confusing navigation bugs for developers during active sessions. 

### Memory Safety
**Safe.** It is a primitive boolean value. It does not hold references to DOM nodes, closures, or large objects, so there is no risk of memory leaks.

## 3. Better Implementation

While the current fix works and patches the bug with minimal code changes, a strictly React-compliant architecture would be vastly superior.

**Option A: Context Ref (The safest minimal change)**
Instead of a module variable, instantiate a `useRef(false)` inside `StaffAuthProvider` and expose it through the `StaffAuthContext` interface. `AuthGuard` can read `context.isLoggingOutRef.current`. This ties the flag strictly to the React component tree and lifecycle, making it fully safe for Concurrent Mode and HMR.

**Option B: Single Responsibility (The architectural ideal)**
Remove the `router.replace("/backoffice/login")` completely from `StaffAuthContext`. Let `AuthGuard` own **all** unauthenticated routing. Whether a user explicitly clicks "Logout", or passively loses their session in another tab, `user` becomes `null`. `AuthGuard` reacts to `!user` and navigates to the login page. This entirely eliminates the need for any coordination flags.
