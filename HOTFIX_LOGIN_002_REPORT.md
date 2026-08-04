# HOTFIX_LOGIN_002_REPORT.md

## Fix Summary
Implemented the experimental `HOTFIX-LOGIN-002` to confirm the router transition audit hypothesis. The goal was to remove the local synchronous state update that was forcing a re-render and cancelling the Next.js navigation.

- **Files Modified:** `app/backoffice/login/page.tsx`

## Modifications

### Lines Removed
The following line was removed from the success branch of the `useEffect` block, immediately prior to the router transition call:

```tsx
-        setIsSubmitting(false);
```

### Resulting Logic
```tsx
    if (user) {
      if (profile) {
        const urlParams = new URLSearchParams(window.location.search);
        const nextUrl = urlParams.get("next") || "/backoffice";
        router.replace(nextUrl);
      } else {
```

## Verification
- **Build Verification**: `npm run build` completed successfully.
- **Rules Followed**: No `startTransition`, timeouts, debounces, or `router.refresh` were added. The fix was isolated exclusively to `page.tsx` and consisted only of a strict removal.
- **Expected Outcome**: With the synchronous `setIsSubmitting(false)` state update removed, React will no longer schedule a high-priority synchronous render on the current component. The `router.replace(nextUrl)` background transition will now complete without interruption, successfully rendering the Dashboard and properly updating the browser URL.
