# ROUTER_TRANSITION_ANALYSIS.md

## Audit Findings

Based on the inspection of `app/backoffice/login/page.tsx`, here are the determinations to the specific questions:

1. **Is `router.replace()` executed inside `useEffect`?**
   Yes, it is executed inside the `useEffect` when the `user` and `profile` dependencies resolve to truthy values.

2. **Can the effect execute multiple times?**
   Yes, if its dependencies change. However, in the success path, it correctly fires when the profile resolves.

3. **Can `router.replace()` be skipped because dependencies change?**
   No, it is not skipped. The code executes the `router.replace()` call, but the resulting transition fails to commit.

4. **Can React keep rendering the Login page after `router.replace()`?**
   Yes. In the Next.js App Router, navigation is a concurrent background transition. The current component (`BackofficeLogin`) remains fully mounted and interactive until the server components for the new route are fetched and the DOM transition commits.

5. **Does Next.js App Router require `startTransition` here?**
   Yes. Mixing local React state updates with Next.js App Router navigation causes React to prioritize the synchronous state update over the concurrent navigation transition. Unless wrapped in `startTransition`, the state update will cancel the navigation.

6. **Is there any pending state that prevents unmount?**
   Yes, the local state update `setIsSubmitting(false)` schedules a re-render of the component, signaling to React that the current view is still active and changing.

7. **Is `isSubmitting` keeping the page alive?**
   **Yes. This is the core issue.** By calling `setIsSubmitting(false)` immediately before `router.replace()`, the code forces a local synchronous re-render of the Login page. 

8. **Is there another render immediately after replace?**
   Yes, the `setIsSubmitting(false)` call guarantees an immediate re-render in the exact same tick.

## Exact Root Cause

The bug is caused by **transition cancellation due to a synchronous state update**. 

When `router.replace(nextUrl)` is called, Next.js initiates a background transition to `/backoffice`. In the very same tick, `setIsSubmitting(false)` schedules a high-priority synchronous React re-render of the Login page. 

React 18's concurrent renderer processes the high-priority local state update and consequently **aborts the low-priority router transition**. Because the transition is aborted, the Next.js router drops the navigation, the browser URL remains stuck on `/backoffice/login`, and the user is left in a broken UI state until they manually refresh the page (F5), which forces a hard navigation to the Dashboard using their valid session cookie.

**Resolution strategy (no code modified per instructions):** 
The `setIsSubmitting(false)` call should be completely removed from the success branch. Because the page is navigating away and will unmount, there is no need to reset the submitting state. Removing it will allow the `router.replace()` transition to complete uninterrupted.
