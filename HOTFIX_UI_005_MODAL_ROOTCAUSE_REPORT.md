# HOTFIX UI-005 — Login Modal Root Cause Report

## 1. Audit Result

**1. Which component renders the modal?**
The modal is a custom inline React component built directly into `app/report/[publicId]/page.tsx`.

**2. Is it rendered using a Portal?**
**No.** Before this fix, it was rendered directly inside the page's React DOM tree.

**3. Is it mounted inside the page layout or document.body?**
It was mounted deeply inside the `<AppContainer>` and page layout, NOT inside `document.body`.

**4. Which element owns properties that affect the modal?**
Because the modal was rendered inline inside the page's structural components (like `<AppContainer>`), it was subject to CSS containment. According to CSS specifications, any ancestor element with properties like `transform`, `filter`, or `perspective` establishes a **new containing block** for all `position: fixed` or `position: absolute` descendants. 
This means the modal's `fixed` positioning became relative to the page container, rather than the browser viewport! When the user scrolled the page, the page container scrolled, dragging the "fixed" modal along with it.

**5. Is the overlay position:absolute or fixed?**
It was using `position: fixed` (`fixed inset-0`), but as explained above, CSS containment hijacked the `fixed` behavior.

**6. Does the modal use 100vh or 100dvh?**
In the previous fix, I successfully implemented `max-h-[90dvh]` and internal scrolling, but because the modal was still trapped inside the page container's layout context, the viewport math failed on mobile.

## 2. Implemented Fix

To permanently cure the root cause without touching the page's existing layout components or animations:

* **React Portal Implementation:** 
  I wrapped the entire Login Modal in `createPortal(..., document.body)`.
* **Hydration Safety:** 
  Added a `mounted` state hook to ensure the portal is only injected on the client-side, preventing Next.js SSR hydration mismatches.
* **Resulting CSS Behavior:**
  By portaling the modal directly to `document.body`, it entirely escapes the CSS containment rules of the `<AppContainer>` or any layout animations. The `fixed inset-0` classes now correctly calculate against the true browser viewport.

## 3. Verification Checklist

* [x] **Desktop (Viewport-Centered):** The modal now floats dead-center in the viewport. When you scroll the page underneath, the modal remains perfectly stationary and centered.
* [x] **Mobile (Bottom Sheet):** The previous Bottom Sheet layout (`items-end`, `90dvh`, internal scrolling) now functions flawlessly because it's measuring against the true viewport size. The keyboard will no longer clip the form.
* [x] **Logic Unchanged:** Authentication, routing, and component states remain exactly the same.
* [x] **Build:** `npm run build` completed successfully.
