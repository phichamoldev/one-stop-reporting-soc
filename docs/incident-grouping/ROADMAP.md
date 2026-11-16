# 12-Week Development Roadmap

> **สถานะ: PLANNING ONLY — แผนการพัฒนาแบบเป็นขั้นเป็นตอน (Phased Milestones)**

---

## 1. ภาพรวมการแบ่งระยะพัฒนา (High-Level Timeline)

โครงการถูกแบ่งออกเป็น 3 ระยะหลัก รวมเวลาทั้งสิ้น 12 สัปดาห์:

```
[ Week 1 - 4 ]   Phase 1: Incident Core & Bulk Actions (รากฐานและการจัดการกลุ่ม)
[ Week 5 - 8 ]   Phase 2: Similarity Detection & Debounced Notifications (ระบบแนะนำและการแจ้งเตือน)
[ Week 9 - 12]   Phase 3: AI Semantic Search & Analytics Dashboard (ปัญญาประดิษฐ์และรายงานสรุป)
```

---

## 2. แผนงานรายสัปดาห์ (Weekly Milestones)

### Phase 1: Incident Core & Bulk Actions (สัปดาห์ที่ 1 - 4)
*เป้าหมาย: เจ้าหน้าที่สามารถสร้าง Incident รวมเรื่อง และทำ Bulk Status/Reply ได้ด้วยตนเอง*

- **สัปดาห์ที่ 1: Database & API Foundation**
  - รัน Migration สร้างตาราง `incidents`, `incident_reports`, `bulk_actions`
  - สร้าง Triggers คำนวณ `report_count` และ `updated_at`
  - ติดตั้ง RLS Policies สำหรับความปลอดภัย
  - พัฒนา Core API CRUD สำหรับ Incident (`/api/incidents`)
- **สัปดาห์ที่ 2: Backoffice Incident UI**
  - พัฒนาหน้ารายการ Incident (`/backoffice/incidents`)
  - พัฒนาหน้าแสดงรายละเอียดและคำร้องในกลุ่ม (`/backoffice/incidents/[publicId]`)
  - พัฒนา Modal สร้าง Incident ใหม่
- **สัปดาห์ที่ 3: Bulk Actions Engine**
  - พัฒนา Stored Procedure `bulk_update_reports` (Atomic transaction)
  - พัฒนา API `/api/bulk-actions/status` และ `/api/bulk-actions/reply`
  - เชื่อมโยง Audit Trail เข้ากับ `report_logs.bulk_action_id`
- **สัปดาห์ที่ 4: Multi-select UI & Soft Unlink (Milestone 1)**
  - เพิ่ม Checkbox และ Floating Action Bar ในหน้ารายการคำร้องเดิม (`/backoffice/reports`)
  - พัฒนาฟังก์ชัน Soft Unlink ปลดคำร้องพร้อมระบุเหตุผล
  - ทดสอบ Unit & Integration Test สำหรับ Phase 1
  - **Deliverable:** Milestone 1 (Internal Alpha: ใช้งาน Incident & Bulk Actions ในห้องทดสอบ)

---

### Phase 2: Smart Suggestions & Debounced Notifications (สัปดาห์ที่ 5 - 8)
*เป้าหมาย: ระบบช่วยจับคู่คำร้องที่ซ้ำกัน และลดการแจ้งเตือนสแปมในกลุ่ม LINE*

- **สัปดาห์ที่ 5: PostgreSQL Trigram Matching Engine**
  - เปิดใช้งาน `pg_trgm` และสร้างฟังก์ชัน Normalization ภาษาไทย
  - พัฒนาระบบ Scoring (Category 40, Subcategory 15, Location 25, Time 10, Status 10)
  - พัฒนา API แนะนำเคส `/api/incidents/suggestions`
- **สัปดาห์ที่ 6: Suggestion Management UI**
  - สร้างแท็บ "คำแนะนำเข้ากลุ่ม" ในหน้า Incident Detail พร้อม Score Bar และเหตุผล
  - ปุ่มกดยอมรับ (Accept) หรือปฏิเสธ (Reject) คำแนะนำ
  - แสดงคำแนะนำ Incident ที่เกี่ยวข้องในหน้า Report Detail
- **สัปดาห์ที่ 7: Notification Queue & Debounce Worker**
  - สร้างตาราง `notification_queue`
  - พัฒนากลยุทธ์ Debounce 5 นาทีสำหรับกลุ่ม LINE เจ้าหน้าที่
  - พัฒนา Background Runner API (`/api/notifications/queue/process`)
- **สัปดาห์ที่ 8: LINE Flex Message & Pilot Rollout (Milestone 2)**
  - ออกแบบ Flex Message: Incident Alert, Summary Update, และ Citizen Status Push
  - ตั้งค่า Cron Job สำหรับรัน Worker
  - ทำ Pilot Rollout ร่วมกับทีมเจ้าหน้าที่ 1 แผนก
  - **Deliverable:** Milestone 2 (Beta Release: ระบบแนะนำและรวบยอด LINE ใช้งานจริงในกลุ่มนำร่อง)

---

### Phase 3: AI Semantic Search & Advanced Analytics (สัปดาห์ที่ 9 - 12)
*เป้าหมาย: วิเคราะห์ความหมายด้วย AI และสรุปภาพรวมผู้บริหาร*

- **สัปดาห์ที่ 9: pgvector & Semantic Embedding**
  - ติดตั้ง `pgvector` ใน Supabase
  - พัฒนาการแปลงข้อความคำร้องเป็น Vector ด้วย OpenAI Embedding
  - ผสาน Hybrid Search (Trigram + Vector) เพื่อจับคู่คำร้องที่ใช้คำต่างกัน
- **สัปดาห์ที่ 10: Pattern Mining & Recurring Issue Detection**
  - พัฒนา Algorithm ตรวจหาจุดเกิดเหตุซ้ำซาก (Hotspots) รายอาคาร/หมวดหมู่
  - สรุปปัญหาเชิงโครงสร้างสำหรับงานซ่อมบำรุงเชิงป้องกัน (Preventive Maintenance)
- **สัปดาห์ที่ 11: Executive Dashboard & Incident Insights**
  - พัฒนาหน้าแดชบอร์ดสถิติ Incident: MTTR (Mean Time to Resolve), สถิติการเกิดเหตุซ้ำ
  - ส่งออกรายงานสรุปสำหรับผู้บริหาร (PDF/Excel)
- **สัปดาห์ที่ 12: Production Hardening & Full GA (Milestone 3)**
  - Performance Tuning (Index optimization, Query profiling)
  - ซ้อมแผน Rollback และ Security Penetration Testing
  - จัดทำเอกสารคู่มือการใช้งานและจัดอบรมเจ้าหน้าที่
  - **Deliverable:** Milestone 3 (Full GA: ปล่อยระบบให้เจ้าหน้าที่ทุกแผนกใช้งาน 100%)

---

## 3. สรุปเป้าหมายและความสำเร็จ (Success Metrics)

| ดัชนีวัดผล (KPI) | ปัจจุบัน (ก่อนทำ) | เป้าหมายหลังติดตั้งระบบ (สัปดาห์ที่ 12) |
|------------------|-------------------|---------------------------------------|
| เวลาที่เจ้าหน้าที่ใช้จัดการคำร้องซ้ำ | 15 - 20 นาที / 10 เคส | $\le 2$ นาที (ลดลง 85%) |
| จำนวนข้อความสแปมในกลุ่ม LINE เจ้าหน้าที่ | 1 ข้อความต่อ 1 คำร้อง | ลดลง $\ge 70\%$ ในช่วงเกิดวิกฤต |
| ความโปร่งใสของประวัติการทำงาน (Audit) | ตรวจสอบคำร้องรวมได้ยาก | ตรวจสอบย้อนหลังได้ 100% ผ่าน `bulk_actions` |
| ความพึงพอใจของเจ้าหน้าที่ผู้ปฏิบัติงาน | 3.2 / 5.0 | $\ge 4.5 / 5.0$ |
