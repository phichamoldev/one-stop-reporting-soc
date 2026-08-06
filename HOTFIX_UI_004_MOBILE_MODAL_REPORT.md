# HOTFIX UI-004 — Mobile Login Modal Responsive Report

## 1. Audit Result

**1. Component Used:**
The login modal is a custom-built inline UI component within `app/report/[publicId]/page.tsx` (starting near line 724). It uses basic Tailwind CSS to render an absolute overlay (`fixed inset-0`). It does not rely on Ant Design, Radix, Dialog, or HeadlessUI.

**2. Height Calculation:**
The modal previously had no strict vertical height limitations or scrollable boundaries (`overflow-hidden` was applied to the outer box, but the inner container was completely unrestricted). This caused it to scale identically to its contents.

**3. Height Property:**
It did not use `height: 100vh` or `100dvh`. Because it lacked constraints, when a virtual keyboard opened on mobile, the viewport shrank, the absolute modal exceeded the viewport, and the browser forcefully clipped the bottom out of view.

**4. Internal Scrolling:**
Internal scrolling was NOT supported. The inner content container was just a standard `<div className="p-6 text-center">`.

**5. iOS Safe Area:**
The safe area (`env(safe-area-inset-bottom)`) was completely ignored, meaning even without the keyboard, the submit button could clash with the iOS home indicator.

## 2. Implemented Fix

I restructured the Tailwind classes of the custom modal to implement a responsive "Bottom Sheet" on mobile, while retaining the standard floating modal appearance on desktop.

* **Bottom Sheet Mobile Mode:**
  * Used `items-end` on the main overlay (mobile only) to push the modal to the very bottom of the screen.
  * Reshaped the container to be flat on the bottom but heavily rounded on top (`rounded-t-[24px] rounded-b-none`).
* **Desktop Integrity:**
  * Preserved the original desktop UI using Tailwind `md:` prefixes (`md:items-center`, `md:rounded-[20px]`).
* **Height & Scrolling Resilience:**
  * Forced a strict ceiling using `max-h-[90dvh]`, ensuring the modal never outgrows the dynamic viewport (even when the keyboard slides up).
  * Turned the parent into a `flex-col` and the header into `shrink-0`, ensuring the header remains fixed at the top of the sheet.
  * Added `overflow-y-auto` to the inner form container, allowing smooth internal scrolling for the email/password fields.
* **Safe Area Support:**
  * Added `pb-[calc(1.5rem+env(safe-area-inset-bottom))]` to the scrollable container. This guarantees the Submit button remains comfortably reachable above the iOS home indicator bar and soft-keyboards.

## 3. Verification Checklist

* [x] **Entire form visible:** Works perfectly within `90dvh`.
* [x] **Scroll works:** Vertical scrolling kicks in naturally only when needed.
* [x] **Keyboard safe:** Tested logic ensures the UI dynamically shrinks and scrolls instead of clipping when the virtual keyboard spawns.
* [x] **Submit reachable:** Safely padded above the home indicator.
* [x] **Desktop unchanged:** Tablet and desktop users still get the beautifully centered modal.
* [x] **Build:** `npm run build` succeeds seamlessly.
