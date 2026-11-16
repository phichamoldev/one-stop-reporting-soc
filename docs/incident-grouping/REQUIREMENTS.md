# Requirements Specification

> **สถานะ: PLANNING ONLY — ยังไม่มีการ implement**

---

## REQ-001: Incident Management

### REQ-001.1 Create Incident

| Field | Value |
|-------|-------|
| ID | REQ-001.1 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (all roles) |
| Description | Staff สามารถสร้าง Incident ใหม่จากการเลือก Reports หลายรายการ |
| Preconditions | Staff authenticated, มีสิทธิ์เข้าถึง Reports ที่เลือก |
| Input | title (required), report_ids[] (required), category_id, location, priority |
| Process | 1. Validate permissions ต่อทุก report_id 2. Create incident 3. Link reports via incident_reports 4. Log to audit_logs |
| Output | Incident object with public_id (INC-YYYYMMDD-NNN) |
| Constraints | ต้องมีอย่างน้อย 1 report, public_id ต้อง unique |
| Test | TC-INC-001 |

### REQ-001.2 View Incident

| Field | Value |
|-------|-------|
| ID | REQ-001.2 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (all roles, dept-scoped) |
| Description | Staff สามารถดูรายละเอียด Incident พร้อม Reports ที่อยู่ในกลุ่ม |
| Preconditions | Staff มีสิทธิ์เข้าถึง department ที่ Incident สังกัด |
| Output | Incident detail + linked reports + timeline + audit trail |
| Constraints | Staff role จะเห็นเฉพาะ Incident ของ dept ตัวเอง |
| Test | TC-INC-002 |

### REQ-001.3 Update Incident

| Field | Value |
|-------|-------|
| ID | REQ-001.3 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (manager+) |
| Description | Staff สามารถแก้ไข title, priority, status, assigned_to |
| Input | title, priority, status, assigned_to |
| Process | 1. Validate permission 2. Update incident 3. Log to audit_logs |
| Status Values | open → in_progress → resolved → closed |
| Constraints | ห้ามข้ามสถานะ (ยกเว้น reopen) |
| Test | TC-INC-003 |

### REQ-001.4 Close Incident

| Field | Value |
|-------|-------|
| ID | REQ-001.4 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (manager+) |
| Description | Staff สามารถปิด Incident ได้ |
| Process | 1. Update status to 'closed' 2. Set closed_at 3. Log audit |
| Constraints | Reports ภายใน Incident ไม่ต้องปิดตาม, ยังคง track แยก |
| Test | TC-INC-004 |

### REQ-001.5 Reopen Incident

| Field | Value |
|-------|-------|
| ID | REQ-001.5 |
| Priority | MEDIUM |
| Status | PROPOSED |
| Actor | Staff (manager+) |
| Description | Staff สามารถเปิด Incident ที่ปิดไปแล้วได้ใหม่ (กรณีปัญหากลับมา) |
| Process | 1. Update status from 'closed'→'open' 2. Clear closed_at 3. Log audit |
| Test | TC-INC-005 |

### REQ-001.6 Assign Incident

| Field | Value |
|-------|-------|
| ID | REQ-001.6 |
| Priority | MEDIUM |
| Status | PROPOSED |
| Actor | Staff (manager+) |
| Description | Staff สามารถมอบหมาย Incident ให้เจ้าหน้าที่คนอื่นได้ |
| Input | assigned_to (staff user id) |
| Constraints | ผู้รับมอบหมายต้องอยู่ใน dept ที่เกี่ยวข้อง |
| Test | TC-INC-006 |

### REQ-001.7 View Incident Reports

| Field | Value |
|-------|-------|
| ID | REQ-001.7 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | แสดง Reports ทั้งหมดที่ link กับ Incident (is_active = true) |
| Output | List of reports with status, reporter, created_at |
| Constraints | Reports ที่ถูก remove (is_active = false) จะไม่แสดงในรายการหลัก แต่ดูได้ในประวัติ |
| Test | TC-INC-007 |

### REQ-001.8 Remove Report from Incident

| Field | Value |
|-------|-------|
| ID | REQ-001.8 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (manager+) |
| Description | Staff สามารถนำ Report ออกจาก Incident ได้โดยไม่ลบ Report |
| Input | report_id, reason (required) |
| Process | 1. SET is_active=false 2. SET removed_by, removed_at, removed_reason 3. Update report_count 4. Log audit |
| Constraints | Report ยังคงอยู่ในระบบ, ยังคง track ได้, ไม่ถูกลบ |
| Test | TC-INC-008 |

### REQ-001.9 Incident History / Timeline

| Field | Value |
|-------|-------|
| ID | REQ-001.9 |
| Priority | MEDIUM |
| Status | PROPOSED |
| Description | แสดง Timeline ของ Incident: สร้าง, เพิ่ม report, ลบ report, เปลี่ยน status, bulk action |
| Data Source | audit_logs WHERE incident_id = X |
| Test | TC-INC-009 |

---

## REQ-002: Incident Suggestion

### REQ-002.1 Detect Similar Reports

| Field | Value |
|-------|-------|
| ID | REQ-002.1 |
| Priority | HIGH |
| Status | PROPOSED |
| Trigger | หลัง INSERT report ใหม่ (async) |
| Description | ระบบคำนวณ match score เทียบกับ open Incidents ที่มีอยู่ |
| Input | New report's category_id, subcategory_id, location, description, created_at |
| Output | List of (incident_id, match_score, match_reasons) |
| Algorithm | ดู MATCHING-RULES.md |
| Constraints | ต้องไม่ block request flow หลัก |
| Test | TC-MATCH-001 |

### REQ-002.2 Calculate Match Score

| Field | Value |
|-------|-------|
| ID | REQ-002.2 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | คำนวณคะแนนจากหลาย factors |
| Factors | Category (40), Location (25), Subcategory (15), Time (10), Status Bonus (10) |
| Threshold HIGH | ≥ 85 (configurable) |
| Threshold MEDIUM | ≥ 60 (configurable) |
| Output | score (0-100), confidence tier (HIGH/MEDIUM/LOW), reasons[] |
| Configurable | ทุก weight, threshold เก็บใน system_settings |
| Test | TC-MATCH-002 |

### REQ-002.3 Show Reasons

| Field | Value |
|-------|-------|
| ID | REQ-002.3 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | แสดงเหตุผลของ match score แบบ human-readable |
| Format | factor, contribution, max_score, evidence, is_positive |
| Example | "✅ หมวดหมู่เดียวกัน +40/40" |
| Test | TC-MATCH-003 |

### REQ-002.4 Suggest Existing Incident

| Field | Value |
|-------|-------|
| ID | REQ-002.4 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | เมื่อ score ≥ threshold → INSERT incident_suggestions |
| Lifecycle | pending → accepted / rejected / expired (7 days) |
| Display | แสดง Banner ใน Backoffice: "พบ X คำร้องที่อาจเป็นเรื่องเดียวกัน" |
| Test | TC-MATCH-004 |

### REQ-002.5 Accept Suggestion

| Field | Value |
|-------|-------|
| ID | REQ-002.5 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (all roles) |
| Process | 1. SET status='accepted' 2. INSERT incident_reports (link_source='suggestion_accepted') 3. Update report_count 4. Log audit |
| Test | TC-MATCH-005 |

### REQ-002.6 Reject Suggestion

| Field | Value |
|-------|-------|
| ID | REQ-002.6 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (all roles) |
| Process | 1. SET status='rejected' 2. Log audit 3. Feedback data for future model tuning |
| Test | TC-MATCH-006 |

### REQ-002.7 Ignore Suggestion (Auto-expire)

| Field | Value |
|-------|-------|
| ID | REQ-002.7 |
| Priority | LOW |
| Status | PROPOSED |
| Description | Suggestions ที่ไม่ถูก review ภายใน 7 วัน → status='expired' |
| Process | Cron job หรือ DB function |
| Test | TC-MATCH-007 |

---

## REQ-003: Bulk Action

### REQ-003.1 Multi-select Reports

| Field | Value |
|-------|-------|
| ID | REQ-003.1 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | Staff สามารถเลือก Reports หลายรายการพร้อมกันใน Report List |
| UI | Checkbox แต่ละแถว + Select All + Selected count |
| Constraints | เลือกได้เฉพาะ Reports ที่มีสิทธิ์ |
| Test | TC-BULK-001 |

### REQ-003.2 Bulk Status Update

| Field | Value |
|-------|-------|
| ID | REQ-003.2 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (all roles, dept-scoped) |
| Input | report_ids[], new_status |
| Process | Transaction: 1. INSERT bulk_actions 2. For each: UPDATE reports + INSERT report_logs 3. INSERT audit_logs |
| Output | { success_count, failed_count, failed_ids[] } |
| Constraints | Status transition rules ยังใช้เหมือนเดิม, partial success allowed |
| Test | TC-BULK-002 |

### REQ-003.3 Bulk Reply

| Field | Value |
|-------|-------|
| ID | REQ-003.3 |
| Priority | HIGH |
| Status | PROPOSED |
| Actor | Staff (all roles, dept-scoped) |
| Input | report_ids[], new_status, message |
| Process | เหมือน Bulk Status + เพิ่ม remark ใน report_logs |
| Test | TC-BULK-003 |

### REQ-003.4 Bulk Assign

| Field | Value |
|-------|-------|
| ID | REQ-003.4 |
| Priority | MEDIUM |
| Status | PROPOSED |
| Input | report_ids[], assigned_to |
| Constraints | ผู้รับมอบหมายต้องอยู่ใน dept ที่เกี่ยวข้อง |
| Test | TC-BULK-004 |

### REQ-003.5 Bulk Group

| Field | Value |
|-------|-------|
| ID | REQ-003.5 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | Staff เลือก Reports → สร้าง Incident ใหม่ หรือ เชื่อมกับ Incident ที่มีอยู่ |
| Options | "สร้าง Incident ใหม่" / "เชื่อมกับ INC-XXX" |
| Test | TC-BULK-005 |

### REQ-003.6 Confirmation

| Field | Value |
|-------|-------|
| ID | REQ-003.6 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | ทุก Bulk Action ต้องผ่าน Confirmation Modal ก่อนดำเนินการ |
| Display | จำนวนรายการ, รายละเอียด action, ผลกระทบ |
| Test | TC-BULK-006 |

### REQ-003.7 Success / Failure Handling

| Field | Value |
|-------|-------|
| ID | REQ-003.7 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | แสดงผลลัพธ์หลัง Bulk Action: สำเร็จ X / ล้มเหลว Y |
| On Partial Failure | แสดงรายการที่ล้มเหลว + เหตุผล |
| Test | TC-BULK-007 |

---

## REQ-004: Notification

### REQ-004.1 Notification Queue

| Field | Value |
|-------|-------|
| ID | REQ-004.1 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | ทุก LINE notification ต้องผ่าน Queue แทนการส่งตรง |
| Lifecycle | pending → processing → sent / failed / cancelled |
| Test | TC-NOTIF-001 |

### REQ-004.2 Debounce

| Field | Value |
|-------|-------|
| ID | REQ-004.2 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | รวม notifications ที่เกิดในช่วงเวลาใกล้กัน (เดียวกัน incident) |
| Window | 5 นาที (configurable) |
| Max Interval | 30 นาที (configurable) — ต้องส่งอย่างน้อยทุก 30 นาที |
| Test | TC-NOTIF-002 |

### REQ-004.3 Aggregation

| Field | Value |
|-------|-------|
| ID | REQ-004.3 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | แทนที่จะส่ง 100 ข้อความ ให้สรุปเป็น "มีผู้แจ้ง X รายใน Y นาที" |
| Test | TC-NOTIF-003 |

### REQ-004.4 Surge Detection

| Field | Value |
|-------|-------|
| ID | REQ-004.4 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | ตรวจจับเมื่อ request เข้ามากผิดปกติ |
| Threshold SUSPECT | ≥ 5 requests / 10 นาที (configurable) |
| Threshold ALERT | ≥ 10 requests / 10 นาที (configurable) |
| Action SUSPECT | Debounce + aggregate |
| Action ALERT | ส่ง LINE Alert ทันที (bypass debounce) |
| Test | TC-NOTIF-004 |

### REQ-004.5 Retry

| Field | Value |
|-------|-------|
| ID | REQ-004.5 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | ถ้าส่ง LINE ล้มเหลว ให้ retry |
| Strategy | Exponential backoff: 2, 4, 8 minutes |
| Max Attempts | 3 (configurable) |
| After Max | status='failed', log error |
| Test | TC-NOTIF-005 |

### REQ-004.6 Idempotency

| Field | Value |
|-------|-------|
| ID | REQ-004.6 |
| Priority | HIGH |
| Status | PROPOSED |
| Description | ป้องกันการส่ง LINE ซ้ำ |
| Key Format | "report:{id}:new", "incident:{id}:update:{5min_bucket}" |
| Mechanism | UNIQUE index on idempotency_key + ON CONFLICT DO NOTHING |
| Test | TC-NOTIF-006 |

### REQ-004.7 Failure Handling

| Field | Value |
|-------|-------|
| ID | REQ-004.7 |
| Priority | MEDIUM |
| Status | PROPOSED |
| Description | Notification failure ต้องไม่กระทบ request flow หลัก |
| Constraints | INSERT report ต้อง commit ก่อน → notification ทำ async |
| Test | TC-NOTIF-007 |

---

## REQ-005: Realtime

### REQ-005.1 Incident Counter (Live)

| Field | Value |
|-------|-------|
| ID | REQ-005.1 |
| Priority | MEDIUM |
| Status | PROPOSED |
| Description | แสดง report_count ของ Incident แบบ real-time |
| Mechanism | Supabase Realtime subscription on incidents table |
| Test | TC-RT-001 |

### REQ-005.2 Report Counter Update

| Field | Value |
|-------|-------|
| ID | REQ-005.2 |
| Priority | MEDIUM |
| Status | PROPOSED |
| Description | Dashboard counters update เมื่อมี report ใหม่ (existing behavior ที่ต้องรักษา) |
| Test | TC-RT-002 |

### REQ-005.3 Live Suggestion Alert

| Field | Value |
|-------|-------|
| ID | REQ-005.3 |
| Priority | LOW |
| Status | PROPOSED |
| Description | แสดง notification เมื่อมี new suggestion เข้ามา |
| Test | TC-RT-003 |

---

## REQ-006: Audit

### REQ-006.1 Audit Trail Requirements

ทุก Action ต้องบันทึก:

| Field | Required | Source |
|-------|----------|--------|
| ใครทำ (user_id) | ✅ | auth.uid() |
| ทำอะไร (action) | ✅ | action string |
| เมื่อไร (created_at) | ✅ | now() |
| กับ Incident ไหน | ✅ ถ้าเกี่ยวข้อง | incident_id |
| กับ Report ไหน | ✅ ถ้าเกี่ยวข้อง | report_id (ใน details JSONB) |
| Bulk Action ไหน | ✅ ถ้าเป็น bulk | bulk_action_id |
| ผลลัพธ์ | ✅ | details JSONB |

### REQ-006.2 Actions ที่ต้องบันทึก

| Action | Level | Table |
|--------|-------|-------|
| create_incident | audit_logs | ✅ |
| close_incident | audit_logs | ✅ |
| reopen_incident | audit_logs | ✅ |
| link_report_to_incident | audit_logs | ✅ |
| remove_report_from_incident | audit_logs | ✅ |
| accept_suggestion | audit_logs | ✅ |
| reject_suggestion | audit_logs | ✅ |
| bulk_status_update | audit_logs + report_logs (per report) | ✅ |
| bulk_reply | audit_logs + report_logs (per report) | ✅ |
| bulk_assign | audit_logs + report_logs (per report) | ✅ |
| status_updated (individual) | report_logs | ✅ (existing) |

---

## Non-Functional Requirements

### NFR-001 Performance

- Matching algorithm ต้องทำงานใน < 500ms per request
- Bulk action 100 reports ต้องเสร็จใน < 5 seconds
- Dashboard load ต้อง < 2 seconds

### NFR-002 Reliability

- Notification failure ต้องไม่กระทบ request creation
- Partial bulk action failure ต้องรายงานผลถูกต้อง
- Queue retry ต้องป้องกัน duplicate send

### NFR-003 Scalability

- รองรับ 100 concurrent report submissions
- Notification queue ต้องรองรับ 1000 pending items

### NFR-004 Security

- Department-scoped access ต้องถูกต้องทุก Incident
- Bulk action ต้อง verify permission ต่อทุก report
- ดู SECURITY.md

### NFR-005 Backward Compatibility

- ระบบเดิมต้องทำงานได้ 100% แม้ feature ใหม่ยังไม่เปิด
- Reporter tracking flow ต้องไม่เปลี่ยน
- Existing API responses ต้องเพิ่ม fields ได้ แต่ห้ามลบ

### NFR-006 Configurability

- Matching weights เก็บใน system_settings
- Surge thresholds เก็บใน system_settings
- Debounce windows เก็บใน system_settings
- Feature flags สำหรับ enable/disable Incident features
