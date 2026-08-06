# HOTFIX UI-002 — Status Dropdown UI Report

## 1. Audit Result

**Component:** `AppSelect` used across the application including the Staff Report page (`app/report/[publicId]/page.tsx`).

**Component Library:** Custom-built React component using standard `useState` and Tailwind CSS. (Not using Radix, HeadlessUI, shadcn, or Ant Design).

**Rendering Context:**
The dropdown menu is rendered **inside the parent container** (inline absolute positioning), not inside a React Portal.

## 2. Issues Identified
1. **Height:** The max height was `max-h-60` (240px) which could feel a bit short or too tall depending on the design scale.
2. **Edges touching:** The inner scroll container had `pr-1` which left very little padding for the scrollbar, and the option backgrounds touched the padded edges awkwardly.
3. **Scrollbar overlap:** A custom scrollbar class was applied, but without enough padding, the scroll thumb overlapped the text.
4. **Selection highlight:** The selection box touched the borders without enough breathing room.
5. **Bottom spacing:** No extra padding at the bottom of the list.
6. **Floating shadow:** The shadow was standard `shadow-xl`, which didn't give it a deeply elevated "floating" menu look.

## 3. Implemented Fixes

The `AppSelect` UI has been overhauled with the following styles to meet your exact specifications:

* **Max Height:** Changed to `max-h-[280px]` (right in the middle of the requested 260–320px range).
* **Padding & Spacing:**
  * Added `p-2.5` to the outer dropdown container.
  * Added `pr-2` to the inner scrollable container to give the scrollbar room.
  * Added `gap-1.5` between options to space them out comfortably.
  * Added `pb-1` to ensure the bottom option doesn't stick directly to the bottom radius.
  * Increased inner padding of each option to `px-3.5` and `min-h-[44px]`.
* **Rounded Corners:** Maintained rounded corners (`rounded-[16px]` for the menu, `rounded-xl` for the options).
* **Floating Look (Shadow):** Applied a premium floating shadow: `shadow-[0_16px_40px_-12px_rgba(0,0,0,0.15)]` along with a subtle `ring-1 ring-black/5`.
* **Z-Index & Clipping:** Kept the `z-[9999]` fix from the previous hotfix to ensure it never clips and appears above cards/dialogs.
* **Selection Status:** Preserved the red background (`bg-[#D1350F]`) but enhanced it with a soft colored shadow (`shadow-md shadow-[#D1350F]/20`) and font weight.
* **No Logic Changed:** All underlying React state, `onChange`, and `value` bindings remain exactly as before.

## 4. Verification

* [x] Dropdown opens normally.
* [x] All options are reachable and scrolling works via `overflow-y-auto`.
* [x] The selected item remains highlighted correctly.
* [x] The menu is fully elevated and not clipped.
* [x] `npm run build` succeeds (verifying no syntax or typescript errors were introduced).
