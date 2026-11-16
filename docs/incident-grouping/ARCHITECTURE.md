# Architecture — Current State & Proposed Design

> **สถานะ: วิเคราะห์เท่านั้น — ยังไม่มีการแก้ไข**

---

## 1. Current Architecture (VERIFIED)

### 1.1 Tech Stack

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Framework | Next.js (App Router) | 16.3.3 | VERIFIED |
| Language | TypeScript | ^5 | VERIFIED |
| UI | React | 19.2.4 | VERIFIED |
| Styling | Tailwind CSS v4 | ^4 | VERIFIED |
| Animation | Framer Motion | 12.42.2 | VERIFIED |
| Data Fetching | SWR | 2.4.2 | VERIFIED |
| Database | Supabase (PostgreSQL 14.5) | — | VERIFIED |
| Auth | Supabase Auth (JWT) | via @supabase/supabase-js 2.110.2 | VERIFIED |
| Realtime | Supabase Realtime (Postgres Changes) | — | VERIFIED |
| LINE | LINE Messaging API (push) | — | VERIFIED |
| Hosting | Vercel | — | VERIFIED |
| Charts | Recharts | 3.9.2 | VERIFIED |
| E2E Test | Playwright | 1.61.1 | VERIFIED |

### 1.2 Database Tables (VERIFIED from live DB)

```
9 tables in public schema:

reports           (17 rows)  RLS: ON   ← คำร้องหลัก
report_logs       (30 rows)  RLS: ON   ← ประวัติการเปลี่ยนแปลง
categories        (0 rows)   RLS: ON   ← หมวดหมู่
subcategories     (1 row)    RLS: ON   ← หมวดหมู่ย่อย
departments       (0 rows)   RLS: ON   ← หน่วยงาน
staff_users       (5 rows)   RLS: ON   ← เจ้าหน้าที่
manager_departments (2 rows) RLS: ON   ← Multi-dept สำหรับ Manager
audit_logs        (13 rows)  RLS: ON   ← Audit logs
system_settings   (0 rows)   RLS: ON   ← ตั้งค่าระบบ
```

### 1.3 reports Table Schema (VERIFIED)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| public_id | text | NO | — |
| tracking_token | text | NO | — (UNIQUE index) |
| location | text | NO | — |
| description | text | NO | — |
| image_url | text | YES | — |
| reporter_name | text | NO | — |
| email | text | NO | — |
| phone | varchar | NO | — |
| status | text | YES | 'received' |
| priority | text | YES | 'normal' |
| admin_remark | text | YES | — |
| category_id | integer | YES | — |
| subcategory_id | integer | YES | — |
| assigned_to | uuid | YES | — |
| completed_by | uuid | YES | — |
| completed_at | timestamptz | YES | — |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

### 1.4 report_logs Table Schema (VERIFIED)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | auto |
| report_id | uuid | NO | — |
| user_id | uuid | YES | — |
| action | varchar | NO | — |
| old_status | varchar | YES | — |
| new_status | varchar | YES | — |
| remark | text | YES | — |
| image_url | text | YES | — |
| created_at | timestamptz | YES | now() |

### 1.5 Existing Indexes (VERIFIED)

```
reports:
  - reports_pkey (id)
  - reports_tracking_token_key (tracking_token) UNIQUE

report_logs:
  - report_logs_pkey (id)
  - idx_report_logs_report_id (report_id)
  - idx_report_logs_user_id (user_id)
  - idx_report_logs_created_at (created_at)

categories:
  - categories_pkey (id)
  - categories_code_key (code) UNIQUE

departments:
  - departments_pkey (id)
  - departments_code_key (code) UNIQUE

staff_users:
  - staff_users_pkey (id)
  - staff_users_email_key (email) UNIQUE
  - staff_users_auth_user_id_key (auth_user_id) UNIQUE
```

### 1.6 Existing Triggers (VERIFIED)

> **ไม่มี Triggers ใน public schema** — ไม่มี auto-update updated_at หรือ counter triggers

### 1.7 Existing Functions (VERIFIED)

> **ไม่มี Functions ใน public schema** — ทุก logic อยู่ใน Application layer (API routes)

### 1.8 Available Extensions (VERIFIED)

| Extension | Installed? | Version Available | Notes |
|-----------|-----------|-------------------|-------|
| pg_trgm | ❌ NO | 1.6 | ต้อง enable ก่อนใช้ text similarity |
| vector (pgvector) | ❌ NO | 0.8.2 | สำหรับ semantic similarity (Phase 2+) |
| uuid-ossp | ✅ YES | 1.1 | ใช้อยู่แล้ว |

### 1.9 RLS Policies Summary (VERIFIED)

| Table | Policy Name | Command | Logic |
|-------|------------|---------|-------|
| reports | deny_all_reports | ALL | false (deny via service_role bypass) |
| reports | reports | SELECT | staff by email + role + dept |
| reports | reports1 | SELECT | staff by auth_user_id + role + dept |
| reports | reports_select_policy | SELECT | authenticated + role + dept |
| report_logs | deny_all_report_logs | ALL | false |
| departments | deny_all_departments | ALL | false |
| staff_users | deny_all_staff_users | ALL | false |
| subcategories | deny_all_subcategories | ALL | false |
| audit_logs | INSERT | super_admin only |
| audit_logs | SELECT | super_admin only |
| system_settings | ALL | super_admin only |
| system_settings | SELECT | any staff |
| manager_departments | SELECT | admin/super_admin OR own record |

> **สำคัญ:** ส่วนใหญ่ใช้ `deny_all` + service_role key bypass — API routes ทำ auth check เอง

### 1.10 Application Architecture (VERIFIED)

```
app/
├── api/
│   ├── reports/
│   │   ├── route.ts              ← POST: Create report + LINE notify
│   │   ├── [publicId]/
│   │   │   ├── route.ts          ← GET: Report detail + auth
│   │   │   └── status/route.ts   ← PATCH: Status update + transfer + log
│   │   └── lookup/               ← Phone-based lookup
│   ├── backoffice/
│   │   ├── dashboard/route.ts    ← GET: Dashboard data + dept filter
│   │   ├── analytics/
│   │   ├── pending-summary/
│   │   ├── settings/
│   │   └── staff/
│   ├── line/webhook/             ← LINE webhook
│   ├── categories/
│   ├── subcategories/
│   ├── departments/
│   └── staff/
├── backoffice/
│   ├── page.tsx                  ← Dashboard
│   ├── reports/
│   │   ├── page.tsx              ← Reports list
│   │   └── [publicId]/page.tsx   ← Report detail
│   ├── analytics/
│   ├── settings/
│   ├── staff/
│   └── login/
├── report/                       ← Public report page
└── track/                        ← Public tracking page
```

### 1.11 LINE Notification Flow (VERIFIED)

```
[POST /api/reports]
  → INSERT report
  → ดึง category → department → line_group_id
  → notifyLine(payload, targetGroupId)  ← Direct call ทุกครั้ง

[PATCH /api/reports/[id]/status] (transfer only)
  → notifyLine(payload, targetLineGroupId)

ข้อจำกัดปัจจุบัน:
  ❌ ไม่มี Queue
  ❌ ไม่มี Retry
  ❌ ไม่มี Debounce/Aggregation
  ❌ ไม่มี Idempotency
  ❌ ไม่มี Notification ถึง Reporter (ส่งถึง LINE Group ของ dept เท่านั้น)
```

### 1.12 Realtime (VERIFIED)

```
RealtimeListener.tsx:
  ← subscribe postgres_changes INSERT/UPDATE on reports
  ← แสดง toast notification ใน Backoffice
  ← mutate SWR cache เมื่อมี INSERT/UPDATE
  
ข้อจำกัดปัจจุบัน:
  ❌ ไม่มี subscription สำหรับ Incident (ยังไม่มี table)
  ❌ ทุก INSERT ส่ง notification แยก → flood ถ้า 100 reports
```

### 1.13 Roles (VERIFIED)

| Role | Dashboard | Reports | Analytics | Staff | Settings |
|------|-----------|---------|-----------|-------|----------|
| super_admin | ✅ | ✅ All depts | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ All depts | ✅ | ✅ | ❌ |
| manager | ✅ | ✅ Assigned depts | ✅ | ❌ | ❌ |
| staff | ✅ | ✅ Own dept only | ❌ | ❌ | ❌ |

---

## 2. Proposed Architecture (PROPOSED)

### 2.1 New Components

```
PROPOSED Architecture Addition:

[Existing] reports table ← ไม่แตะ
                │
    ┌───────────┴───────────┐
    │                       │
[NEW] incidents         [NEW] notification_queue
    │                       │
[NEW] incident_reports  [NEW] Notification Worker
    │                       │
[NEW] incident_suggestions  [LINE Messaging API]
    │
[NEW] bulk_actions
    │
[MODIFY] report_logs  ← เพิ่ม column: bulk_action_id
[MODIFY] audit_logs   ← เพิ่ม columns: bulk_action_id, incident_id
```

### 2.2 Data Flow — New Request

```
[Reporter submits form]
    │
    ▼
POST /api/reports (existing)
    │
    ├─► INSERT reports (existing behavior, unchanged)
    │
    ├─► [NEW] Run Matching Algorithm (async, non-blocking)
    │       → Find open incidents with matching category+location+time
    │       → Calculate score
    │       → IF score >= threshold: INSERT incident_suggestions
    │
    └─► [NEW] Enqueue LINE Notification (replace direct call)
            → INSERT notification_queue (send_after = NOW for new report)
            → Notification Worker sends later via cron

[Notification Worker — Vercel Cron every 1 min]
    │
    ├─► SELECT pending notifications WHERE send_after <= NOW()
    ├─► Debounce: merge multiple updates for same incident
    ├─► Send LINE via API
    └─► UPDATE queue status (sent/failed/retry)
```

### 2.3 Data Flow — Staff Bulk Action

```
[Staff selects multiple reports]
    │
    ▼
POST /api/incidents/[id]/bulk-action
    │
    ├─► Auth + Permission check
    ├─► BEGIN TRANSACTION
    │     ├─► INSERT bulk_actions
    │     ├─► FOR EACH report: UPDATE reports.status + INSERT report_logs
    │     └─► INSERT audit_logs
    ├─► COMMIT
    └─► Enqueue LINE notifications (per reporter, outside transaction)
```

---

## 3. UNKNOWN Items

ยังไม่สามารถยืนยันได้:

| Item | ผลกระทบ | วิธีตรวจสอบ |
|------|---------|-----------|
| Vercel Cron availability/limits | Notification Worker | ตรวจ Vercel plan |
| LINE rate limits | Surge notification | ตรวจ LINE developer console |
| Supabase plan limits (Realtime connections) | Live counter | ตรวจ Supabase dashboard |
| Actual report volume per day/month | Performance sizing | Query production data |
| Foreign key constraints in DB | Schema integrity | information_schema.referential_constraints returned empty — may use app-level FK |
