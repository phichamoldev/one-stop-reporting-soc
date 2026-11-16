# Detailed Task Breakdown for Developers

> **สถานะ: PLANNING ONLY — รายการงานย่อย (Work Breakdown Structure) พร้อม Task ID และการประเมินเวลา**

---

## 1. กลุ่มงาน Database & Migrations (TASK-DB)

| Task ID | รายละเอียดงาน | Area | ประเมินเวลา | งานที่ต้องทำก่อน |
|---------|---------------|------|:-----------:|:----------------:|
| `TASK-DB-001` | ติดตั้งส่วนขยาย `pg_trgm` ในฐานข้อมูล Supabase | DB Extension | 1 ชม. | - |
| `TASK-DB-002` | สร้าง Migration สร้าง Tables ใหม่ (`incidents`, `incident_reports`, `incident_suggestions`, `bulk_actions`, `notification_queue`) พร้อม Indexes และ Constraints | DDL Schema | 4 ชม. | `TASK-DB-001` |
| `TASK-DB-003` | สร้าง Migration เพิ่มคอลัมน์ `bulk_action_id` ใน `report_logs` และ `audit_logs` | Alter Tables | 2 ชม. | `TASK-DB-002` |
| `TASK-DB-004` | สร้าง Trigger และฟังก์ชัน `sync_incident_report_count` สำหรับคำนวณ `report_count` อัตโนมัติ | Triggers | 3 ชม. | `TASK-DB-002` |
| `TASK-DB-005` | สร้าง Stored Procedure `bulk_update_reports` สำหรับประมวลผลการเปลี่ยนสถานะแบบ Atomic | PL/pgSQL | 4 ชม. | `TASK-DB-003` |
| `TASK-DB-006` | เขียนและเปิดใช้งาน RLS Policies สำหรับ Tables ใหม่ทุกตัวตามเอกสาร Security | Security RLS | 4 ชม. | `TASK-DB-002` |

---

## 2. กลุ่มงาน Backend API & Services (TASK-BE)

| Task ID | รายละเอียดงาน | Endpoint / Service | ประเมินเวลา | งานที่ต้องทำก่อน |
|---------|---------------|-------------------|:-----------:|:----------------:|
| `TASK-BE-001` | พัฒนา Type Definitions / Interfaces สำหรับ Incident, Suggestion, BulkAction ใน TypeScript | `src/types` | 2 ชม. | `TASK-DB-002` |
| `TASK-BE-002` | พัฒนา API `POST /api/incidents` (สร้าง Incident ใหม่) | API Route | 3 ชม. | `TASK-BE-001` |
| `TASK-BE-003` | พัฒนา API `GET /api/incidents` (ดึงรายการและ Filter ตามสถานะ, ความสำคัญ, หมวดหมู่) | API Route | 3 ชม. | `TASK-BE-001` |
| `TASK-BE-004` | พัฒนา API `GET /api/incidents/[publicId]` (ดึงรายละเอียด, Active Reports, Removed Reports) | API Route | 4 ชม. | `TASK-BE-001` |
| `TASK-BE-005` | พัฒนา API `PATCH /api/incidents/[publicId]` (แก้ไขข้อมูลทั่วไปของ Incident) | API Route | 2 ชม. | `TASK-BE-004` |
| `TASK-BE-006` | พัฒนา API `POST /api/incidents/[publicId]/status` (เปลี่ยนสถานะ Incident + Cascade) | API Route | 4 ชม. | `TASK-BE-004` |
| `TASK-BE-007` | พัฒนา API `POST /api/incidents/[publicId]/reports` (ผูก Report เข้ากับ Incident) | API Route | 3 ชม. | `TASK-BE-004` |
| `TASK-BE-008` | พัฒนา API `DELETE /api/incidents/[publicId]/reports/[reportId]` (Soft remove คำร้องพร้อมบันทึกเหตุผล) | API Route | 3 ชม. | `TASK-BE-004` |
| `TASK-BE-009` | พัฒนาฟังก์ชันคำนวณ Similarity Score (Rule-based + pg_trgm + Thai Normalizer) | Service | 6 ชม. | `TASK-DB-001` |
| `TASK-BE-010` | พัฒนา API `GET /api/incidents/suggestions` และ Accept/Reject Handlers | API Route | 4 ชม. | `TASK-BE-009` |
| `TASK-BE-011` | พัฒนา API `/api/bulk-actions/status` และ `/api/bulk-actions/reply` | API Route | 5 ชม. | `TASK-DB-005` |
| `TASK-BE-012` | พัฒนา Notification Worker Route `/api/notifications/queue/process` พร้อม Debounce Logic | Worker API | 6 ชม. | `TASK-DB-002` |

---

## 3. กลุ่มงาน Frontend UI & Components (TASK-FE)

| Task ID | รายละเอียดงาน | Page / Component | ประเมินเวลา | งานที่ต้องทำก่อน |
|---------|---------------|------------------|:-----------:|:----------------:|
| `TASK-FE-001` | เพิ่มเมนู "Incidents (จัดการเหตุการณ์)" ใน Sidebar Backoffice | Sidebar Nav | 1 ชม. | - |
| `TASK-FE-002` | พัฒนาหน้ารายการ Incident `/backoffice/incidents` พร้อม Filter, Sort, Pagination | Page Component | 6 ชม. | `TASK-BE-003` |
| `TASK-FE-003` | พัฒนา Modal สร้าง Incident ใหม่ (`CreateIncidentModal`) | Modal Component | 4 ชม. | `TASK-BE-002` |
| `TASK-FE-004` | พัฒนาหน้า Incident Detail Layout (`/backoffice/incidents/[publicId]`) | Page Layout | 5 ชม. | `TASK-BE-004` |
| `TASK-FE-005` | พัฒนาแท็บ "คำร้องในกลุ่ม (Active Reports)" พร้อม Checkbox multi-select | Tab Component | 4 ชม. | `TASK-FE-004` |
| `TASK-FE-006` | พัฒนาแท็บ "คำแนะนำเข้ากลุ่ม (Suggestions)" พร้อม Score Bar และปุ่ม Accept/Reject | Tab Component | 5 ชม. | `TASK-BE-010` |
| `TASK-FE-007` | พัฒนาแท็บ "ประวัติการดำเนินการรวม (Bulk History)" และ "คำร้องที่ปลดออก" | Tab Component | 3 ชม. | `TASK-FE-004` |
| `TASK-FE-008` | พัฒนา Modal ยืนยันการปลดคำร้อง (`UnlinkReportModal`) พร้อมช่องกรอกเหตุผลบังคับ | Modal Component | 2 ชม. | `TASK-BE-008` |
| `TASK-FE-009` | พัฒนา Floating Bulk Action Bar ในหน้ารายการคำร้องเดิม (`/backoffice/reports`) | Component | 5 ชม. | `TASK-BE-011` |
| `TASK-FE-010` | พัฒนา Modal ทำ Bulk Status Change และ Bulk Reply พร้อม Preview | Modal Component | 4 ชม. | `TASK-FE-009` |
| `TASK-FE-011` | เพิ่ม Incident Link Badge ในแถวของตารางคำร้องเดิม | Component | 2 ชม. | `TASK-BE-004` |
| `TASK-FE-012` | เพิ่ม Sidebar Info Card "คำร้องนี้อยู่ใน Incident" ในหน้ารายละเอียดคำร้องเดิม | Component | 3 ชม. | `TASK-BE-004` |

---

## 4. กลุ่มงาน LINE Notification & Worker (TASK-INT)

| Task ID | รายละเอียดงาน | Integration | ประเมินเวลา | งานที่ต้องทำก่อน |
|---------|---------------|-------------|:-----------:|:----------------:|
| `TASK-INT-001` | ออกแบบและสร้าง TypeScript Helper ประกอบ LINE Flex Message (Incident Alert) | LINE Flex Builder | 3 ชม. | `TASK-BE-001` |
| `TASK-INT-002` | ออกแบบ Flex Message สรุปยอดรวบ (Aggregated Summary) | LINE Flex Builder | 2 ชม. | `TASK-INT-001` |
| `TASK-INT-003` | พัฒนา Service ส่ง Individual Push Message ผ่าน LINE SDK ให้ผู้แจ้งแต่ละคน | LINE Service | 4 ชม. | `TASK-BE-012` |
| `TASK-INT-004` | ตั้งค่า Vercel Cron หรือ External Cron เพื่อกระตุ้น Queue Worker ทุก 1 นาที | DevOps / Cron | 2 ชม. | `TASK-BE-012` |

---

## 5. กลุ่มงาน Testing & Quality Assurance (TASK-QA)

| Task ID | รายละเอียดงาน | Type | ประเมินเวลา | งานที่ต้องทำก่อน |
|---------|---------------|------|:-----------:|:----------------:|
| `TASK-QA-001` | เขียน Unit Test ตรวจสอบ Similarity Scoring & Thai Text Normalizer | Vitest | 3 ชม. | `TASK-BE-009` |
| `TASK-QA-002` | เขียน Test สำหรับ Stored Procedure `bulk_update_reports` (ทดสอบ Concurrency & Rollback) | DB Test | 4 ชม. | `TASK-DB-005` |
| `TASK-QA-003` | เขียน Test ทดสอบ RLS Policy แต่ละ Role ห้ามล่วงเกินสิทธิ์ | RLS Test | 4 ชม. | `TASK-DB-006` |
| `TASK-QA-004` | เขียน E2E Test (Playwright) จำลองกระบวนการ Create Incident -> Group -> Bulk Status | E2E Playwright | 6 ชม. | `TASK-FE-010` |
| `TASK-QA-005` | ตรวจสอบ Zero-Regression ของ Flow การรับเรื่องเดิม (Form Submit, Line Webhook) | Regression Test | 4 ชม. | `TASK-FE-012` |
