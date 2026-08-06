# HOTFIX UI-002D — Status Dropdown Initial Open Animation Report

## 1. Audit Result

**1. Which component library is used?**
A Custom React component (`src/components/ui/AppSelect.tsx`).

**2. Which animation library is used?**
Tailwind CSS Animate plugin (`animate-in fade-in zoom-in-95`).

**3. Is the popup initially rendered at x=0, y=0?**
Yes. The state `coords` was initialized with `{ top: 0, left: 0 }`.

**4. Does the popup use transform-based animation before placement?**
Yes. When the popup was opened for the first time, it rendered immediately at `0, 0` while a `useEffect` simultaneously fired to read the DOM layout and update the position. Because `useEffect` executes *after* the browser's first paint, the CSS `animate-in` transition was already forcefully kicked off at `top: 0, left: 0`. A frame later, the state updated with the correct coordinates, causing the animating popup to visibly "slide" or "jump" across the screen into place.

**5. Does getPopupContainer or Portal affect the first render position?**
Because it is rendered via a Portal straight to `document.body` with `position: fixed`, `0, 0` exactly corresponds to the top-left corner of the window viewport.

**6. Does the page layout finish rendering AFTER the popup animation starts?**
The layout was fine, but React's asynchronous rendering cycle caused the positioning logic to lag one frame behind the portal's initial mount and animation trigger.

## 2. Implemented Fix

To permanently cure this without disabling the beautiful `animate-in` UI effects or introducing complex `useLayoutEffect` logic that angers Next.js SSR:

* **Synchronous Pre-calculation:** 
  I completely rewired how the coordinates are captured. Instead of waiting for a `useEffect` to fire *after* the component opens, I moved the coordinate calculation (`getBoundingClientRect()`) directly into the button's `onClick` handler (`handleToggle`).
* **React State Batching:** 
  By executing `updatePosition()` and `setIsOpen(true)` sequentially within the same exact click event, React batches both state updates into a single render pass.
* **The Result:** 
  When the portal finally mounts to the DOM, it already possesses the exact `top` and `left` target coordinates. The `animate-in` CSS transition now executes perfectly in-place directly beneath the Select component without any horizontal jumping, sliding, or `0, 0` flickering.

## 3. Verification Checklist

* [x] **Opens directly below the Select:** Coords are pre-loaded before mount.
* [x] **Never animates from left edge:** The `0, 0` flash is completely eliminated.
* [x] **Never jumps or slides:** Starts animation already in its final position.
* [x] **Calculates position before animation:** Verified via synchronous `onClick` batching.
* [x] **Preserved other animations:** No Tailwind CSS classes were disabled.
* [x] **Build:** `npm run build` succeeds perfectly.
