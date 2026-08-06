# HOTFIX UI-002C — Status Dropdown Position & UX Report

## 1. Audit Result

**1. Which Select component is used?**
The dropdown is a Custom React component (`AppSelect`), located at `src/components/ui/AppSelect.tsx`.

**2. How is the popup rendered?**
The popup is rendered into the root `document.body` via React's `createPortal` (implemented in the previous fix).

**3. Why does the popup move while the page scrolls?**
The popup used `position: fixed` relying on the trigger button's viewport coordinates (`getBoundingClientRect()`). When the user scrolled the page, the button physically moved up the screen. Although a `scroll` event listener was firing to recalculate the coordinates, React's asynchronous state updates naturally lag behind the browser's native paint cycle by a single frame. This discrepancy causes a noticeable "drifting" or "lagging" effect where the popup struggles to catch up to the scrolling button.

**4. Positioning method**
The popup was using `position: fixed` relative to the viewport.

**5. Why is the popup forcing an internal scrollbar?**
The inner container explicitly applied `max-h-[280px]` and `overflow-y-auto custom-scrollbar`. Even if there were only a few options, the structure was forcing it into a scrollable box format when it wasn't necessary for small lists.

## 2. Implemented Fixes

**Drifting Fix (Close on Scroll):**
The most seamless and robust UX pattern for custom floating dropdowns (without injecting heavy third-party positioning engines like FloatingUI) is to simply close the dropdown when the page scrolls. 
* I modified the `scroll` event listener. Instead of continuously attempting to calculate the `top` position during scroll (which causes visual drifting), it now simply triggers `setIsOpen(false)`.
* This perfectly anchors the component—it opens cleanly, stays exactly attached to its trigger button, and quietly dismisses itself if the user starts scrolling away.

**Internal Scrollbar Removal:**
* I completely removed the `max-h-[280px]`, `overflow-y-auto`, and `custom-scrollbar` classes from the popup's inner container.
* Replaced it with a standard `flex flex-col gap-1.5 p-1` container.
* The dropdown now naturally scales its height to fit exactly the number of status options inside it, completely eliminating the unnecessary scrollbar.

## 3. Verification Checklist

* [x] **Dropdown remains correctly attached:** Because the position only calculates when the dropdown is static.
* [x] **Closes automatically on scroll:** Verified. This entirely prevents drifting and provides an industry-standard native feel.
* [x] **Automatically sizes to content:** Height scales perfectly with the few status options provided.
* [x] **No internal scrollbar:** Removed all `overflow` rules.
* [x] **Build:** `npm run build` succeeds without any syntax or type errors.
