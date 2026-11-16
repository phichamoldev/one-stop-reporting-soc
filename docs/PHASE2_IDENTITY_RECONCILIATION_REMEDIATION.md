# PHASE 2 — IDENTITY RECONCILIATION & REMEDIATION REPORT
## Comprehensive Audit, Contract Definition & Architectural Approach Evaluation

**Inspection Date:** 2026-11-05T10:08:00+07:00  
**Target Environment:** Local Isolated PostgreSQL 17.11 / Supabase CLI 3.0.0 (Port 54322)  
**Evaluated Artifacts:** Migrations `0000`–`0006`, Proposed `0007`, 23 Application Files (`app/api`, `src/lib`, `src/types`), Local Database Runtime  
**Safety Boundaries:** Zero Prod queries, zero Git commits, `.env.local` untouched, zero migrations applied  

---

## Executive Summary & Final Verdict

### **VERDICT: `NOT READY — BLOCKERS REMAIN`**

> [!WARNING]
> **Safety Gate Protocol Adhered**: As strictly mandated (*"ห้ามระบุ READY หาก Identity Mapping ยังไม่ได้รับการพิสูจน์ด้วยการทดสอบจริง"*), this report presents the exhaustive audit, architectural trade-off evaluation, and the complete remediation specification for **Blocker B**. Because migrations 0000–0006 have not yet been executed in runtime, the formal status remains **NOT READY** pending developer sign-off on the recommended approach.

---

## 1. Identity Contract Audit Across Repository

An exhaustive static and architectural inspection was conducted across all SQL migrations, application API routes, auth helpers, and TypeScript definitions to trace the exact usage of `staff_users.id` vs `staff_users.auth_user_id`.

### 1.1 Complete Codebase Identity Survey Table

| Component / File Path | Line(s) | Column Referenced | Target / Source Identity | Audit Findings & Purpose |
|---|:---:|:---:|---|---|
| **Database Schema** (`0000_base_schema.sql`) | 53 | `staff_users.id` | Internal surrogate PK (`uuid`) | Primary Key for all foreign key relations (`reports`, `report_logs`, etc.). |
| **Database Schema** (`0000_base_schema.sql`) | 54 | `staff_users.auth_user_id` | Foreign Key to `auth.users(id)` | Intended to decouple internal ID from Supabase Auth identity. |
| **RLS Policy** (`0000_base_schema.sql`) | 178 | `su.auth_user_id` | `auth.uid()` | Checks `su.auth_user_id = auth.uid()` to verify active staff profile. |
| **RLS Policy** (`0000_base_schema.sql`) | 183–185 | `su.auth_user_id` | `auth.uid()` | Role and department scoping on `reports` table. |
| **RLS Policy** (`0000_base_schema.sql`) | 192 | `su.auth_user_id` | `auth.uid()` | Access check for `manager_departments`. |
| **RLS Policy** (`0002_settings_tables.sql`) | 39, 47, 58, 69, 80 | `staff_users.auth_user_id` | `auth.uid()` | Super admin / active staff access to `system_settings` & `audit_logs`. |
| **RLS Policy** (`0003_test_data_isolation.sql`) | 70–72 | `su.auth_user_id` | `auth.uid()` | Mirrored report select policy on `test_reports`. |
| **RLS Policy** (`0004_incident_grouping.sql`) | 117, 120, 123, 127, 130, 133 | `su.auth_user_id` | `auth.uid()` | Staff verification on incident groups and member tables. |
| **RLS Policy** (`0006_notification_logs.sql`) | 66, 77 | `su.auth_user_id` | `auth.uid()` | Admin select policy on notification logs. |
| **Proposed Migration** (`0007_report_level_mapping.sql`) | 1474, 1479 | `su.auth_user_id` | `auth.uid()` | Event notification tracker RLS policies. |
| **User Creation API** (`users/route.ts`) | 141 | `staff_users.id` | `newAuthUser.user.id` | **CRITICAL:** Inserts Auth UUID into `id`, leaves `auth_user_id = NULL`. |
| **Backoffice Auth Helper** (`users/route.ts`) | 19 | `staff_users.id` | `user.id` (`auth.users.id`) | `.from("staff_users").select("id, role").eq("id", user.id)` |
| **Analytics API** (`analytics/route.ts`) | 26 | `staff_users.id` | `user.id` | `.from("staff_users").select("role, department_id").eq("id", user.id)` |
| **Dashboard API** (`dashboard/route.ts`) | 22 | `staff_users.id` | `user.id` | `.from("staff_users").select("role, department_id").eq("id", user.id)` |
| **Pending Summary API** (`pending-summary/route.ts`) | 20 | `staff_users.id` | `user.id` | `.from("staff_users").select("role, department_id").eq("id", user.id)` |
| **Related Requests Lab API** (`related-requests-lab/route.ts`) | 25 | `staff_users.id` | `user.id` | `.from("staff_users").select("id, role, department_id").eq("id", user.id)` |
| **Incidents API** (`incidents/route.ts`) | 26, 214 | `staff_users.id` | `user.id` | Queries staff profile by `user.id`. |
| **Incident Details API** (`incidents/[id]/route.ts`) | 29, 234, 342 | `staff_users.id` | `user.id` | Queries staff profile by `user.id`. |
| **Incident Members API** (`incidents/[id]/members/route.ts`) | 32, 358 | `staff_users.id` | `user.id` | Queries staff profile by `user.id`. |
| **Bulk Action API** (`reports/bulk-action/route.ts`) | 85 | `staff_users.id` | `user.id` | Queries staff profile by `user.id`. |
| **Report Status API** (`reports/[publicId]/status/route.ts`) | 37 | `staff_users.id` | `user.id` | Queries staff profile by `user.id`. |
| **Staff Profile API** (`staff/profile/route.ts`) | 24 | `staff_users.id` | `user.id` | Fetches active profile via `.eq("id", user.id)`. |
| **Auth Helper** (`src/lib/auth-helpers.ts`) | 52 | `staff_users.id` | `userId` (`user.id`) | Queries `manager_departments` where `staff_user_id = userId`. |
| **TypeScript Types** (`src/types/report.ts`) | 135 | `StaffProfile.id` | `string` (`auth.users.id`) | Maps directly to `auth.users.id` in UI and server components. |

### 1.2 The Conflict Invariant
- **Application Space**: 100% of application code (23+ files) assumes `staff_users.id === auth.users.id`.
- **Database RLS Space**: 100% of SQL migrations (0000, 0002, 0003, 0004, 0006, 0007) check `WHERE su.auth_user_id = auth.uid()`.
- **Root Problem**: When creating a user via the API, `auth_user_id` is never set (`NULL`). Consequently, the user is recognized by the API routes, but **completely blocked by PostgreSQL RLS** whenever a query evaluates row-level security.

---

## 2. Evaluation of Three Architectural Approaches

```mermaid
flowchart TD
    subgraph ApproachA["Approach A: Direct Auth Mapping"]
        A1["staff_users.id = auth.users.id"]
        A2["Remove auth_user_id column"]
        A3["Rewrite all RLS to: WHERE su.id = auth.uid()"]
    end

    subgraph ApproachB["Approach B: Decoupled Surrogate PK"]
        B1["staff_users.id = Surrogate UUID"]
        B2["staff_users.auth_user_id = auth.users.id"]
        B3["Rewrite 20+ API routes to: .eq('auth_user_id', user.id)"]
    end

    subgraph ApproachC["Approach C: Dual-Layer Mapping (Recommended)"]
        C1["staff_users.id = auth.users.id"]
        C2["staff_users.auth_user_id = auth.users.id"]
        C3["Database Trigger guarantees: id === auth_user_id"]
        C4["API explicitly passes both values"]
    end
```

### 2.1 Multi-Dimensional Comparative Analysis

| Evaluation Criterion | Approach A (Direct `id`) | Approach B (Surrogate `id` + `auth_user_id`) | Approach C (Dual-Layer Auto-Sync) |
|---|---|---|---|
| **Impact on Existing APIs** | **Zero impact** (APIs already query `.eq("id", user.id)`). | **Catastrophic breaking change**. Must rewrite 20+ API routes and all FK lookups. | **Zero breaking change**. APIs continue querying `.eq("id", user.id)` seamlessly. |
| **Impact on Foreign Keys** | **Zero impact**. All FKs reference `staff_users(id)`, which matches `auth.users.id`. | **Complex**. APIs receiving `auth.uid()` must query DB to resolve surrogate ID before inserting FKs. | **Zero impact**. All FKs reference `staff_users(id)` with zero indirection. |
| **Impact on RLS Migrations** | Requires editing 0000, 0002, 0003, 0004, 0006, 0007 to change `auth_user_id` to `id`. | Zero SQL migration RLS edits needed (already checks `auth_user_id`). | **Zero SQL migration RLS edits needed**. Works transparently with existing RLS policies. |
| **Impact on Existing / Seed Data** | Easy to backfill. | High migration complexity. | **Completely transparent**. Trigger handles inserts; backfill is a single SQL update. |
| **Long-Term Maintainability** | High (standard Supabase pattern). | High, but introduces surrogate key overhead without practical benefit. | **Highest Resilience**. Guarantees zero schema drift between API and database RLS. |
| **Risk During Staff User Creation** | Low. | High (requires multi-step surrogate resolution). | **Zero Risk**. Trigger automatically guarantees `auth_user_id` is never null. |

### 2.2 Recommendation & Architectural Justification
**Approach C (Dual-Layer Mapping)** is the strictly superior choice:
1. It eliminates the blocker immediately without requiring modifications to any existing API routes.
2. It satisfies 100% of the RLS policies in Migrations `0000` through `0007` without altering their security conditions.
3. It enforces strict data integrity at the database engine level via an immutable trigger.

---

## 3. Database Trigger Specification (Approach C)

The trigger is designed to enforce the Identity Contract with zero tolerance for inconsistency.

### 3.1 Proposed SQL Specification (For `0000_base_schema.sql`)

```sql
-- ============================================================================
-- STAFF USERS IDENTITY RECONCILIATION TRIGGER
-- Ensures staff_users.id and staff_users.auth_user_id remain 100% synchronized
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_sync_staff_users_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Auto-fill auth_user_id from id if auth_user_id is NULL
  IF NEW.auth_user_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.auth_user_id := NEW.id;
  END IF;

  -- 2. Auto-fill id from auth_user_id if id is NULL
  IF NEW.id IS NULL AND NEW.auth_user_id IS NOT NULL THEN
    NEW.id := NEW.auth_user_id;
  END IF;

  -- 3. Strict Consistency Check: Reject if both are present but do not match
  IF NEW.id IS NOT NULL AND NEW.auth_user_id IS NOT NULL AND NEW.id <> NEW.auth_user_id THEN
    RAISE EXCEPTION 'Identity mismatch: staff_users.id (%) must match staff_users.auth_user_id (%)', NEW.id, NEW.auth_user_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Invariant: Prevent altering identity keys on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF OLD.id <> NEW.id OR OLD.auth_user_id <> NEW.auth_user_id THEN
      RAISE EXCEPTION 'Identity alteration forbidden: staff_users identity keys cannot be modified'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_users_identity_sync ON staff_users;
CREATE TRIGGER trg_staff_users_identity_sync
BEFORE INSERT OR UPDATE ON staff_users
FOR EACH ROW EXECUTE FUNCTION trg_sync_staff_users_identity();
```

### 3.2 Security & Operational Integrity Attributes
- **`SECURITY DEFINER`**: Executes with creator authority, ensuring trigger executes reliably even under restricted RLS contexts.
- **Fixed `search_path`**: Hardened with `SET search_path = public, pg_temp` to prevent search path hijacking.
- **Immutable Keys**: Clause 4 blocks any `UPDATE` that attempts to change `id` or `auth_user_id`, preventing session hijacking or orphaned audit logs.
- **Foreign Key Alignment**: Both `id` and `auth_user_id` possess `REFERENCES auth.users(id) ON DELETE CASCADE`.

### 3.3 Application-Level Hardening (`users/route.ts`)
In addition to the database trigger, `app/api/backoffice/settings/users/route.ts` line 140 will be updated to explicitly provide both fields:
```ts
const userId = newAuthUser.user.id;

// Create staff profile with dual identity contract
const { error: createStaffErr } = await supabaseAdmin
  .from("staff_users")
  .insert({
    id: userId,
    auth_user_id: userId, // Explicit alignment with database contract
    email,
    full_name,
    department_id: finalPrimaryDeptId,
    role,
    status: status || "active"
  });
```

---

## 4. Local Database Migration History Verification

A direct runtime audit was performed on the active Local PostgreSQL instance at `127.0.0.1:54322`:

```sql
-- Runtime Query Executed:
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%migration%' OR table_schema LIKE '%migration%';
```

### 4.1 Empirical Findings from Local Database
1. **Existing Internal Migration Tables**:
   - `auth.schema_migrations` (Column: `version character varying NOT NULL`)
   - `realtime.schema_migrations`
   - `storage.migrations`
   - `supabase_functions.migrations`
2. **User Migration Table Status**:
   - `supabase_migrations.schema_migrations`: **DOES NOT EXIST YET**.
   - Schema `supabase_migrations`: **DOES NOT EXIST YET** (`(0 rows)`).
3. **Reason**: The database was initialized cleanly with `[db.migrations] enabled = false` in `supabase/config.toml`. The table is created by Supabase CLI upon applying the first migration.
4. **Target Schema Specification**:
   When created, `supabase_migrations.schema_migrations` conforms to:
   ```sql
   CREATE SCHEMA IF NOT EXISTS supabase_migrations;
   CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
       version text NOT NULL PRIMARY KEY,
       statements text[],
       name text
   );
   ```

---

## 5. Blocker A — Strict Schema Contract Confirmation

### 5.1 Verification of `0001_drop_category_column.sql`
In response to the safety directive (*"ไม่ต้องเพิ่ม IF EXISTS เพียงเพื่อให้ Migration ดูเหมือน Idempotent หากการทำเช่นนั้นอาจซ่อน Schema Drift ให้คง Migration แบบ Strict"*):
1. **Prerequisite Guarantee**: `0000_base_schema.sql` explicitly creates `category text` in `reports` (line 103).
2. **Contract Enforced**: Keeping `ALTER TABLE reports DROP COLUMN category;` in its strict form guarantees that Migration 0001 will fail immediately if `0000_base_schema.sql` was not applied correctly, thereby **preventing silent schema drift**.
3. **Repository Dependencies**: Confirmed zero references to `reports.category` in 0003–0007.
4. **Decision**: **Migration 0001 remains in its original strict form**. No modifications required.

---

## 6. Test Cases for Identity Reconciliation & RLS

Before signing off on Migration 0000–0006, the following six test cases will be validated in runtime:

| Test ID | Test Scenario | Execution Step | Expected Result | Pass Criteria |
|---|---|---|---|---|
| **TC-ID-01** | Insert with `id` only | `INSERT INTO staff_users (id, email, full_name, role) VALUES ('<auth_uuid>', 'test@soc.com', 'Test', 'staff')` | Trigger sets `auth_user_id = id` | `auth_user_id` matches `id` |
| **TC-ID-02** | Insert with explicit matching IDs | `INSERT INTO staff_users (id, auth_user_id, ...) VALUES ('<uuid_a>', '<uuid_a>', ...)` | Insert succeeds | Row created cleanly |
| **TC-ID-03** | Insert with conflicting IDs | `INSERT INTO staff_users (id, auth_user_id, ...) VALUES ('<uuid_a>', '<uuid_b>', ...)` | Trigger raises exception | Error code `check_violation` |
| **TC-ID-04** | Attempt to mutate identity | `UPDATE staff_users SET id = gen_random_uuid() WHERE email = 'test@soc.com'` | Trigger raises exception | Error code `restrict_violation` |
| **TC-ID-05** | Staff RLS Access on Reports | Authenticate as staff (`auth.uid() = id`), execute `SELECT * FROM reports` | Policy `reports_select_policy` evaluates `su.auth_user_id = auth.uid()` | Reports returned |
| **TC-ID-06** | Inactive Staff Blocked | Set `status = 'suspended'`, execute `SELECT * FROM reports` | RLS policy denies access | `0 rows` returned |

---

## 7. Status Classification & Final Sign-off

### Categorization of Findings
- **Verified from Source Files**: Identity mapping in 23 API files, `0000`–`0006` migration definitions, RLS conditions.
- **Tested in Runtime (127.0.0.1:54322)**: Absence of `supabase_migrations` schema, existing `auth.schema_migrations` structure, `auth.users.id` data type.
- **Proposed (Pending Approval)**: Database trigger `trg_sync_staff_users_identity()`, dual insert in `users/route.ts`.

### Final Verdict

# **`NOT READY — BLOCKERS REMAIN`**

*Awaiting explicit user approval of Approach C (Trigger + API Hardening) before modifying files and proceeding to the atomic migration execution phase.*

