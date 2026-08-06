# HOTFIX UI-003 — Timeline Metadata Responsive Layout Report

## 1. Audit Result

**Components Modified:**
1. `app/report/[publicId]/page.tsx` (Staff Report Page)
2. `app/track/[publicId]/page.tsx` (Public Tracking Page)

**Issue Context:**
The timeline items render metadata (Date/Time and Operator Name) inside a single flex row. 
Previously, the layout wrapper was structured as:
```tsx
<div className="flex items-center gap-3 ...">
```
Because `flex-wrap` was missing, and the items lacked `shrink-0` or breaking rules, rendering a long operator name like `"ผู้ดูแลระบบสูงสุด"` on narrow mobile screens (320px–430px) caused the Date/Time and Operator Name elements to collide, overlap, and clip.

## 2. Implemented Fixes

The layout was overhauled using Tailwind CSS responsive utility classes to explicitly handle narrow mobile screens gracefully while preserving the desktop layout.

* **Responsive Flex-Direction:** 
  Changed the parent container from a rigid horizontal row to a responsive column-to-row layout:
  `className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 ..."`
  - On mobile screens (`< 640px`), the Date/Time and Operator Name are stacked vertically (`flex-col`), eliminating any horizontal collision.
  - On tablet/desktop screens (`>= 640px`), they sit side-by-side (`sm:flex-row`).
* **Text Wrapping and Truncation:** 
  Added `break-words` and `line-clamp-2` to the Operator Name container so excessively long titles wrap cleanly without breaking the bounding box.
* **Icon Preservation:** 
  Added `shrink-0` to the Clock and User icons to prevent them from becoming squished when text pushes against them.
  Added `mt-0.5 sm:mt-0` to the User icon to ensure it vertically aligns properly with the first line of the wrapped text on mobile.
* **No Logic Changed:** 
  The underlying sorting, data rendering, completion note, and report status workflows remain entirely unchanged.

## 3. Verification Checklist

* [x] **Short names:** Renders correctly.
* [x] **Long names ("ผู้ดูแลระบบสูงสุด"):** Cleanly wraps and stacks on mobile without overlapping.
* [x] **Mobile width (320px–430px):** Metadata stacks vertically (`flex-col`) with proper spacing (`gap-1.5`).
* [x] **Tablet/Desktop:** Metadata displays in a single horizontal row (`flex-row`) with `gap-3`.
* [x] **Build:** `npm run build` succeeds without errors.
