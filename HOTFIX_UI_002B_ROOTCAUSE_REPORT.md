# HOTFIX UI-002B — Root Cause Audit for Status Dropdown Report

## 1. Audit Result

**1. Which Select component is used?**
The dropdown is a Custom React component (`AppSelect`), located at `src/components/ui/AppSelect.tsx`. It relies on standard Tailwind CSS for styling and `useState`/`useEffect` for logic. It does not use Radix, HeadlessUI, shadcn, or Ant Design.

**2. Where is the popup rendered?**
Previously, the popup was rendered directly inside its parent container within the DOM hierarchy (inline absolute rendering).

**3. Does any parent have clipping properties?**
Yes. In `app/report/[publicId]/page.tsx`, the `AppSelect` component is placed inside an `AppCard` component. The `AppCard` explicitly defines the `overflow-hidden` utility class:
```tsx
<AppCard className="!p-0 border-primary/20 shadow-sm overflow-hidden ring-1 ring-primary/10 rounded-[16px]">
```
This establishes a strict clipping context. Because the dropdown menu was rendered as a direct child inside this card, it was mathematically constrained by the card's boundaries. 

**4. Why did z-index fixes fail?**
Z-index only dictates the stacking order *within the current stacking context*. If a parent element has `overflow-hidden` (or `contain: paint`), any child that bleeds outside its physical dimensions is chopped off by the browser engine before z-index even matters.

## 2. Implemented Fix (The Portal Strategy)

To fix this natively without redesigning the UI layout or unsetting `overflow-hidden` on parent cards (which would break rounded corners):

* **React `createPortal` Integration:** 
  I wrapped the dropdown menu in `createPortal(..., document.body)`. This completely decouples the popup from the DOM hierarchy of `AppCard`, rendering it at the very root of the HTML document where no clipping containers can affect it.
* **Dynamic Positioning Calculation:** 
  Because the popup is no longer inside `AppSelect`, it cannot use basic `absolute` positioning. I implemented a dynamic coordinate tracker using `getBoundingClientRect()` that calculates the exact position and width of the trigger button.
* **Scroll & Resize Tracking:** 
  Added event listeners for `scroll` (with `{ capture: true }`) and `resize` to recalculate the coordinates in real-time, ensuring the dropdown stays perfectly glued to its parent input as the user scrolls the page.
* **Hydration Safety:** 
  Added a `mounted` state to ensure the portal is only invoked client-side, preventing Next.js SSR hydration errors.

## 3. Verification Checklist

* [x] **Dropdown opens fully:** It breaks completely out of the `AppCard`.
* [x] **Last item visible:** The clipping is 100% resolved.
* [x] **Scroll works:** Real-time listeners update the position correctly.
* [x] **Popup is never clipped:** Tested against `overflow-hidden`.
* [x] **Mobile / Tablet / Desktop:** Coordinates calculate correctly regardless of responsive grid layout.
* [x] **Build:** `npm run build` succeeds without errors.
