# API Specification — Incident Grouping & Bulk Action

> **สถานะ: PLANNING ONLY — ยังไม่มีการสร้างหรือแก้ไข Route Handler ในระบบ**

---

## 1. ภาพรวม API Architecture

- **Framework:** Next.js 15 App Router (`app/api/.../route.ts`)
- **Authentication:** Supabase Auth via Cookie Header (`StaffAuthContext` / Bearer token / Session)
- **Role-based Authorization:** ตรวจสอบ Role จากตาราง `staff_users` (`super_admin`, `executive`, `manager`, `staff`, `viewer`)
- **Content-Type:** `application/json`
- **Error Response Standard:** RFC 7807 (Problem Details) / JSON มาตรฐาน

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "คำอธิบายข้อผิดพลาดภาษาไทยที่เข้าใจง่าย",
    "details": []
  }
}
```

---

## 2. Authentication & Authorization Matrix

| Endpoint | Method | Allowed Roles | Audit Log |
|----------|--------|---------------|-----------|
| `/api/incidents` | GET | `super_admin`, `executive`, `manager`, `staff`, `viewer` | No |
| `/api/incidents` | POST | `super_admin`, `manager`, `staff` | Yes |
| `/api/incidents/[publicId]` | GET | `super_admin`, `executive`, `manager`, `staff`, `viewer` | No |
| `/api/incidents/[publicId]` | PATCH | `super_admin`, `manager`, `staff` | Yes |
| `/api/incidents/[publicId]/status` | POST | `super_admin`, `manager`, `staff` | Yes |
| `/api/incidents/[publicId]/reports` | POST | `super_admin`, `manager`, `staff` | Yes |
| `/api/incidents/[publicId]/reports/[reportId]` | DELETE | `super_admin`, `manager` (Staff ต้องมีเหตผล) | Yes |
| `/api/incidents/suggestions` | GET | `super_admin`, `executive`, `manager`, `staff` | No |
| `/api/incidents/suggestions/[id]/accept` | POST | `super_admin`, `manager`, `staff` | Yes |
| `/api/incidents/suggestions/[id]/reject` | POST | `super_admin`, `manager`, `staff` | Yes |
| `/api/reports/[publicId]/detect-similar`| POST | `super_admin`, `manager`, `staff` | No |
| `/api/bulk-actions/reply` | POST | `super_admin`, `manager`, `staff` | Yes |
| `/api/bulk-actions/status` | POST | `super_admin`, `manager`, `staff` | Yes |
| `/api/bulk-actions/assign` | POST | `super_admin`, `manager` | Yes |
| `/api/bulk-actions/group` | POST | `super_admin`, `manager`, `staff` | Yes |
| `/api/notifications/queue/process` | POST | `service_role` / CRON Secret | Yes |

---

## 3. Incident Endpoints

### 3.1 List Incidents
- **URL:** `GET /api/incidents`
- **Query Parameters:**
  - `status`: `open` | `in_progress` | `resolved` | `closed` | `all` (default: `open,in_progress`)
  - `priority`: `low` | `normal` | `high` | `critical`
  - `category_id`: `number`
  - `assigned_to`: `UUID`
  - `q`: `string` (ค้นหา title, public_id, location)
  - `page`: `number` (default: 1)
  - `limit`: `number` (default: 20, max: 100)
  - `sort`: `created_at:desc` | `report_count:desc` | `updated_at:desc`

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "e4b6c2d1-9a7f-4f8a-a92c-8f1b2c3d4e5f",
      "public_id": "INC-20260925-001",
      "title": "ท่อประปาแตกหน้าอาคารเรียนรวม 1",
      "description": "น้ำไหลท่วมทางเท้าและลานจอดรถ มีนักศึกษาแจ้งเข้ามาหลายราย",
      "category": { "id": 1, "name": "กายภาพและสิ่งแวดล้อม" },
      "subcategory": { "id": 4, "name": "ท่อประปา/น้ำรั่ว" },
      "location": "หน้าอาคารเรียนรวม 1 ชั้น 1",
      "status": "in_progress",
      "priority": "high",
      "report_count": 8,
      "assigned_to": {
        "id": "u-1234",
        "name": "สมชาย ช่างซ่อม",
        "department": "ฝ่ายอาคารสถานที่"
      },
      "created_at": "2026-09-25T08:30:00Z",
      "updated_at": "2026-09-25T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

---

### 3.2 Create Incident
- **URL:** `POST /api/incidents`
- **Request Body:**
```json
{
  "title": "ไฟฟ้าดับทั้งอาคารวิศวกรรม 3",
  "description": "หม้อแปลงไฟฟ้ามีเสียงดังระเบิด ไฟฟ้าดับสนิท",
  "category_id": 2,
  "subcategory_id": 8,
  "location": "อาคารวิศวกรรมศาสตร์ 3",
  "priority": "critical",
  "assigned_to": "8c45d61f-9988-4e12-b9e4-8f0a1c2d3e4f",
  "initial_report_ids": [
    "7a2e5d8b-1122-4433-8899-abcdef012345",
    "b8c3d1e9-4455-6677-9900-123456789abc"
  ]
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": "f8a9b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "public_id": "INC-20260925-002",
    "title": "ไฟฟ้าดับทั้งอาคารวิศวกรรม 3",
    "status": "open",
    "report_count": 2,
    "created_at": "2026-09-25T09:30:00Z"
  }
}
```

---

### 3.3 Get Incident Details
- **URL:** `GET /api/incidents/[publicId]`
- **Response `200 OK`:**
```json
{
  "data": {
    "id": "e4b6c2d1-9a7f-4f8a-a92c-8f1b2c3d4e5f",
    "public_id": "INC-20260925-001",
    "title": "ท่อประปาแตกหน้าอาคารเรียนรวม 1",
    "description": "น้ำไหลท่วมทางเท้าและลานจอดรถ มีนักศึกษาแจ้งเข้ามาหลายราย",
    "category": { "id": 1, "name": "กายภาพและสิ่งแวดล้อม" },
    "subcategory": { "id": 4, "name": "ท่อประปา/น้ำรั่ว" },
    "location": "หน้าอาคารเรียนรวม 1 ชั้น 1",
    "status": "in_progress",
    "priority": "high",
    "report_count": 3,
    "created_by": { "id": "uuid-1", "name": "เจ้าหน้าที่รับเรื่อง A" },
    "assigned_to": { "id": "uuid-2", "name": "สมชาย ช่างซ่อม" },
    "created_at": "2026-09-25T08:30:00Z",
    "updated_at": "2026-09-25T09:15:00Z",
    "reports": [
      {
        "id": "rep-uuid-1",
        "public_id": "R20260925-0012",
        "title": "น้ำท่วมลานจอดรถอาคารรวม 1",
        "status": "in_progress",
        "reporter_name": "สมหญิง รักดี",
        "reporter_phone": "081-xxx-xxxx",
        "location": "อาคารเรียนรวม 1 ลานจอด",
        "created_at": "2026-09-25T08:15:00Z",
        "link_metadata": {
          "linked_at": "2026-09-25T08:35:00Z",
          "link_source": "manual",
          "linked_by": "เจ้าหน้าที่รับเรื่อง A"
        }
      }
    ],
    "removed_reports": [
      {
        "id": "rep-uuid-9",
        "public_id": "R20260925-0005",
        "title": "ก๊อกน้ำห้องน้ำชายชั้น 2 หยด",
        "removed_at": "2026-09-25T08:45:00Z",
        "removed_reason": "ไม่ใช่จุดเดียวกัน เป็นเรื่องก๊อกน้ำชั้น 2 แยกเป็นงานซ่อมปกติ"
      }
    ],
    "bulk_history": [
      {
        "id": "ba-uuid-1",
        "action_type": "bulk_status",
        "new_status": "in_progress",
        "performed_by": "สมชาย ช่างซ่อม",
        "created_at": "2026-09-25T09:15:00Z",
        "report_count": 3
      }
    ]
  }
}
```

---

### 3.4 Update Incident Status
- **URL:** `POST /api/incidents/[publicId]/status`
- **Request Body:**
```json
{
  "status": "resolved",
  "resolution_note": "เปลี่ยนข้อต่อท่อประปาหลักเรียบร้อยแล้ว ทดสอบแรงดันน้ำปกติ",
  "cascade_to_reports": true,
  "notify_reporters": true
}
```
**Response `200 OK`:**
```json
{
  "success": true,
  "incident_id": "INC-20260925-001",
  "old_status": "in_progress",
  "new_status": "resolved",
  "affected_reports_count": 3,
  "notifications_queued": 3
}
```

---

### 3.5 Link Reports to Incident
- **URL:** `POST /api/incidents/[publicId]/reports`
- **Request Body:**
```json
{
  "report_ids": [
    "7a2e5d8b-1122-4433-8899-abcdef012345"
  ],
  "link_source": "manual"
}
```
**Response `200 OK`:**
```json
{
  "success": true,
  "linked_count": 1,
  "total_active_reports": 4
}
```

---

### 3.6 Remove Report from Incident (Soft Remove)
- **URL:** `DELETE /api/incidents/[publicId]/reports/[reportId]`
- **Request Body:**
```json
{
  "reason": "ผู้แจ้งระบุผิดตึก สถานที่จริงคืออาคาร 2 ไม่ใช่เหตุการณ์ท่อแตกที่อาคาร 1"
}
```
**Response `200 OK`:**
```json
{
  "success": true,
  "message": "ปลดคำร้องออกจาก Incident สำเร็จ",
  "report_id": "7a2e5d8b-1122-4433-8899-abcdef012345",
  "is_active": false
}
```

---

## 4. Suggestion & Matching Endpoints

### 4.1 List Suggestions
- **URL:** `GET /api/incidents/suggestions`
- **Query Parameters:**
  - `status`: `pending` | `accepted` | `rejected` (default: `pending`)
  - `incident_id`: `UUID`
  - `limit`: `number` (default: 20)

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "sug-uuid-001",
      "report": {
        "id": "rep-uuid-5",
        "public_id": "R20260925-0044",
        "title": "น้ำเจิ่งนองเต็มถนนข้างตึกรวม 1",
        "category_id": 1,
        "location": "ถนนข้างตึกรวม 1",
        "created_at": "2026-09-25T09:20:00Z"
      },
      "target_incident": {
        "id": "inc-uuid-1",
        "public_id": "INC-20260925-001",
        "title": "ท่อประปาแตกหน้าอาคารเรียนรวม 1",
        "status": "in_progress"
      },
      "match_score": 88.5,
      "confidence": "HIGH",
      "match_reasons": {
        "factors": [
          { "factor": "category_exact", "score": 40, "max": 40 },
          { "factor": "location_trigram", "score": 23.5, "max": 25, "raw_sim": 0.94 },
          { "factor": "time_window", "score": 10, "max": 10, "diff_hours": 0.8 },
          { "factor": "status_bonus", "score": 15, "max": 15 }
        ]
      },
      "created_at": "2026-09-25T09:21:00Z"
    }
  ]
}
```

---

### 4.2 Accept Suggestion
- **URL:** `POST /api/incidents/suggestions/[id]/accept`
- **Request Body:** `{}` (empty or optional notes)
- **Response `200 OK`:**
```json
{
  "success": true,
  "status": "accepted",
  "incident_public_id": "INC-20260925-001",
  "report_public_id": "R20260925-0044"
}
```

---

### 4.3 Reject Suggestion
- **URL:** `POST /api/incidents/suggestions/[id]/reject`
- **Request Body:**
```json
{
  "reason": "คนละสาเหตุ ไม่ใช่เรื่องเดียวกัน"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "status": "rejected"
}
```

---

## 5. Bulk Action Endpoints

### 5.1 Bulk Status Change
- **URL:** `POST /api/bulk-actions/status`
- **Request Body:**
```json
{
  "incident_id": "e4b6c2d1-9a7f-4f8a-a92c-8f1b2c3d4e5f",
  "report_ids": [
    "rep-uuid-1",
    "rep-uuid-2",
    "rep-uuid-3"
  ],
  "new_status": "in_progress",
  "remark": "ทีมช่างกำลังเข้าหน้างานพร้อมอุปกรณ์ซ่อมแซม",
  "notify_line": true
}
```
**Response `200 OK`:**
```json
{
  "bulk_action_id": "ba-uuid-77",
  "total_requested": 3,
  "success_count": 3,
  "failed_count": 0,
  "failed_details": []
}
```

---

### 5.2 Bulk Reply Message
- **URL:** `POST /api/bulk-actions/reply`
- **Request Body:**
```json
{
  "incident_id": "e4b6c2d1-9a7f-4f8a-a92c-8f1b2c3d4e5f",
  "report_ids": [
    "rep-uuid-1",
    "rep-uuid-2"
  ],
  "message": "เจ้าหน้าที่รับทราบเหตุแล้ว และขณะนี้กำลังประสานงานตัดวาล์วน้ำหลักเพื่อความปลอดภัย",
  "is_internal_note": false,
  "send_line_flex": true
}
```
**Response `200 OK`:**
```json
{
  "bulk_action_id": "ba-uuid-78",
  "dispatched_count": 2,
  "line_queued_count": 2
}
```

---

### 5.3 Bulk Group (Create Incident From Multi-Select)
- **URL:** `POST /api/bulk-actions/group`
- **Request Body:**
```json
{
  "report_ids": [
    "rep-uuid-1",
    "rep-uuid-2",
    "rep-uuid-3",
    "rep-uuid-4"
  ],
  "incident_title": "เหตุลิฟต์โดยสารค้าง อาคาร 14 ชั้น 4-5",
  "description": "รวม 4 คำร้องที่แจ้งเข้ามาในเวลาไล่เลี่ยกัน",
  "priority": "high",
  "category_id": 1,
  "assigned_to": "uuid-tech-lead"
}
```
**Response `201 Created`:**
```json
{
  "success": true,
  "incident_public_id": "INC-20260925-003",
  "reports_linked": 4
}
```

---

## 6. Notification Queue & Background Dispatch

### 6.1 Process Notification Queue (Worker / Cron Trigger)
- **URL:** `POST /api/notifications/queue/process`
- **Headers:** `Authorization: Bearer <CRON_SECRET_TOKEN>`
- **Request Body:**
```json
{
  "limit": 50,
  "force": false
}
```
**Response `200 OK`:**
```json
{
  "processed": 8,
  "sent": 7,
  "debounced_deferred": 3,
  "failed": 1,
  "duration_ms": 420
}
```

---

## 7. Error Codes Reference

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `UNAUTHORIZED` | 401 | ไม่พบคุกกี้หรือ Token สิทธิ์การเข้าถึง |
| `FORBIDDEN` | 403 | Role ไม่มีสิทธิ์ดำเนินการตาม Action ที่ระบุ |
| `INCIDENT_NOT_FOUND` | 404 | ไม่พบ Incident ตาม publicId หรือ id ที่ระบุ |
| `REPORT_NOT_FOUND` | 404 | ไม่พบ Report ที่ระบุ |
| `INVALID_STATUS_TRANSITION` | 422 | การเปลี่ยนสถานะผิดกฎ เช่น closed -> open โดยไม่ reopen |
| `ALREADY_LINKED` | 409 | Report เชื่อมต่อกับ Incident นี้อยู่แล้ว |
| `SUGGESTION_EXPIRED` | 410 | คำแนะนำจับคู่หมดอายุแล้ว (เกิน 7 วัน) |
| `RATE_LIMITED` | 429 | มีการเรียก API ถี่เกินกำหนด (Debounce protection) |
| `INTERNAL_SERVER_ERROR` | 500 | ความผิดพลาดของระบบหรือ Database |
