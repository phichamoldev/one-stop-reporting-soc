# HOTFIX UI-001 — Dropdown + Completion Note

## Objective

Fix two specific UI bugs on the Staff Report page without affecting any other workflows.

## Bug 1 — Dropdown UI

**Problem:** Dropdown is rendered behind other UI elements and is clipped.

**Root Cause:** The `AppSelect` component's dropdown was relying on `z-[99]`. However, when used inside containers without a higher `z-index`, subsequent sibling elements or containers could overlap the dropdown.

**Fix:** Added a dynamic `z-[9999]` class to the relative wrapper of the `AppSelect` component when `isOpen` is true. This ensures the component sits above other sibling cards and dialogs without needing a Portal or structural redesign.

**File Modified:** `src/components/ui/AppSelect.tsx`

## Bug 2 — Completion Note

**Problem:** The Completion Note (หมายเหตุสรุปผล) is successfully saved when Staff changes the report status to "ดำเนินการเสร็จสิ้น", but after saving, the Completion Note is not displayed when reopening the report.

**Root Cause:** The `fetchReport` function in the Staff Report page (`app/report/[publicId]/page.tsx`) was not passing the `Authorization` header. As a result, the `/api/reports/[publicId]` endpoint considered the request unauthenticated and deleted PII data, including the `admin_remark` (Completion Note).

**Fix:** Updated `fetchReport` to attach the `Authorization` header using `supabase.auth.getSession()` if a session exists. This allows authenticated staff to retrieve the `admin_remark` correctly and populate the Completion Note.

**File Modified:** `app/report/[publicId]/page.tsx`

## Verification

- **Dropdown UI:** The dropdown in `AppSelect` correctly overlaps any UI elements.
- **Completion Note:** Staff can now see previously saved Completion Notes when reopening the report.
- **Build:** `npm run build` completes successfully with no regressions.
