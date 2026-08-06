# Roles Found

| Role | Source File | Description |
|------|-------------|-------------|
| **Super Admin** (`super_admin`) | `src/components/backoffice/settings/UserFormModal.tsx`, `src/lib/auth-helpers.ts` | The highest level of access (ผู้ดูแลระบบสูงสุด). Has access to all departments (`[]`) and settings. |
| **Admin** (`admin`) | `src/components/backoffice/settings/UserFormModal.tsx`, `src/lib/auth-helpers.ts` | System Administrator (ผู้ดูแลระบบ). Has access to all departments (`[]`), but no access to system settings. |
| **Manager** (`manager`) | `src/components/backoffice/settings/UserFormModal.tsx`, `src/lib/auth-helpers.ts` | Department Manager (หัวหน้าส่วนงาน). Access restricted to their own department and assigned departments via `manager_departments`. |
| **Staff** (`staff`) | `src/components/backoffice/settings/UserFormModal.tsx`, `src/lib/auth-helpers.ts` | General Staff (เจ้าหน้าที่). Access restricted to only their primary department. Cannot access Dashboard, Analytics, or Transfer reports. |
| **Public** (Unauthenticated) | N/A | General users creating/tracking reports. |

---

# Permission Matrix

| Feature | Super Admin | Admin | Manager | Staff | Viewer | Public |
|---------|-------------|-------|---------|-------|--------|--------|
| Dashboard | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | ✅ | ❌ | 🟡 |
| Create Report | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Edit Report | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete Report | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign Staff | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer Report | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change Status | ✅ | ✅ | 🟡 | 🟡 | ❌ | ❌ |
| Completion Note | ✅ | ✅ | 🟡 | 🟡 | ❌ | ❌ |
| Upload Completion Image | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export Report | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Categories | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ Allowed
- ❌ Denied / Not Implemented
- ⚠️ UI only (backend not protected)
- 🔒 Backend protected
- 🟡 Conditional (Public: Only if they have publicId. Manager/Staff: Only for reports in their allowed departments)

*Note: Features marked ❌ are not implemented in the current system (e.g., Delete Report, Assign Staff, Export Report).*

---

# Route Protection

This is enforced by `src/lib/auth-helpers.ts` (`hasAccess`) and `AuthGuard.tsx`:

- **`/backoffice/settings/*`**: Super Admin only.
- **`/backoffice`** (Dashboard): Super Admin, Admin, Manager. (Staff is hidden).
- **`/backoffice/analytics`**: Super Admin, Admin, Manager. (Staff is hidden).
- **`/backoffice/staff`**: Super Admin, Admin, Manager. (Staff is hidden).
- **`/backoffice/reports`**: Super Admin, Admin, Manager, Staff.
- **`/report/[publicId]`**: Public (Anyone).
- **`/track/[publicId]`**: Public (Anyone).

---

# API Protection

| API Endpoint | Protection Level | Source File |
|--------------|------------------|-------------|
| `GET/PATCH /api/backoffice/settings/*` | **Super Admin** | `settings/users/route.ts`, `settings/system/route.ts` (via `verifySuperAdmin`) |
| `GET /api/backoffice/analytics` | **Super Admin, Admin, Manager** | `analytics/route.ts` (Explicitly returns 403 `if (role === "staff")`) |
| `GET /api/backoffice/staff/dashboard` | **Super Admin, Admin, Manager** | `staff/dashboard/route.ts` (Explicitly returns 403 `if (profile.role === "staff")`) |
| `GET /api/backoffice/dashboard` | **Authenticated Users** | `dashboard/route.ts` (Does NOT check role. Staff can access it, but UI hides it) |
| `GET /api/backoffice/pending-summary`| **Authenticated Users** | `pending-summary/route.ts` (Does NOT check role. Staff can access it, but UI hides it) |
| `PATCH /api/reports/[publicId]/status` | **Authenticated Users (Conditional)** | `reports/[publicId]/status/route.ts` (Super Admin/Admin: All. Manager/Staff: Only accessible departments. Staff: Blocked from "transfer" status) |
| `POST /api/reports` | **Public** | `reports/route.ts` (No auth required) |
| `GET /api/reports/[publicId]` | **Public** | `reports/[publicId]/route.ts` (No auth required) |

---

# RLS Audit

Based on `supabase/migrations/0002_settings_tables.sql`, the following Row Level Security (RLS) policies exist:

1. **`Super Admins can manage system settings`**
   - **Table:** `system_settings` (FOR ALL)
   - **Affects:** Super Admin only (`AND staff_users.role = 'super_admin'`)

2. **`Super Admins can view system settings`**
   - **Table:** `system_settings` (FOR SELECT)
   - **Affects:** ANY authenticated staff. The `USING` clause **forgets** to check the role: `EXISTS (SELECT 1 FROM staff_users WHERE staff_users.id = auth.uid())`. This affects all roles.

3. **`Super Admins can view audit logs`**
   - **Table:** `audit_logs` (FOR SELECT)
   - **Affects:** Super Admin only (`AND staff_users.role = 'super_admin'`)

4. **`Super Admins can insert audit logs`**
   - **Table:** `audit_logs` (FOR INSERT)
   - **Affects:** Super Admin only (`AND staff_users.role = 'super_admin'`)

*Note: No RLS policies are defined in source control for other tables (e.g., `reports`, `categories`, `departments`, `staff_users`). They are completely missing from migrations.*

---

# Security Findings

**1. Backend allows but UI hides (Dashboard & Pending Summary)**
- **File:** `app/api/backoffice/dashboard/route.ts` and `app/api/backoffice/pending-summary/route.ts`
- **Issue:** The UI uses `hasAccess` to hide these pages from the `staff` role. However, the backend API endpoints never explicitly block `staff`. A staff member calling the API directly will successfully receive data for their department.

**2. Privilege Escalation (System Settings Read Access)**
- **File:** `supabase/migrations/0002_settings_tables.sql` (Lines 44-51)
- **Issue:** The policy named `"Super Admins can view system settings"` checks if the user exists in `staff_users`, but entirely omits the `staff_users.role = 'super_admin'` condition. This grants all staff (including basic staff and managers) read access to system configuration.

**3. Missing Authorization (Features Not Implemented)**
- **Issue:** Several features such as Delete Report, Manage Categories, Assign Staff, and Export Report do not exist in the codebase at all (no frontend UI, no backend APIs).

**4. Missing RLS**
- **Issue:** The source control does not contain any RLS definitions for the core business tables (`reports`, `categories`, `departments`, `staff_users`, etc.). If they are not configured manually in the Supabase Dashboard, the database is vulnerable to direct unauthorized access.
