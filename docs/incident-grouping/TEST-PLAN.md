# Test Plan & Quality Assurance — Incident Grouping & Bulk Action

> **สถานะ: PLANNING ONLY — แผนการทดสอบระบบและเกณฑ์การตรวจรับ (Acceptance Criteria)**

---

## 1. กลยุทธ์การทดสอบ (Testing Strategy)

การทดสอบแบ่งออกเป็น 4 ระดับ เพื่อรับประกันว่าระบบเดิมจะไม่ได้รับผลกระทบใด ๆ:

1. **Unit Tests (Vitest / Jest):**
   - อัลกอริทึมการคำนวณคะแนน Similarity (`calcMatchScore`)
   - ฟังก์ชันจัดการข้อความสถานที่ภาษาไทย (`normalizeThaiLocation`)
   - ฟังก์ชันสร้างรหัส Incident (`generateIncidentPublicId`)
2. **Database & Integration Tests:**
   - ทดสอบ Triggers ใน PostgreSQL (`sync_incident_report_count`, `updated_at`)
   - ทดสอบ RLS Policies สำหรับแต่ละบทบาทใน `staff_users`
   - ทดสอบ Stored Procedure `bulk_update_reports` ความเป็น Atomic Transaction
3. **API & End-to-End Tests (Playwright):**
   - Workflow ตั้งแต่มี Report เข้ามา ➔ ระบบตรวจจับและแนะนำ ➔ เจ้าหน้าที่กดยืนยันผูกเข้า Incident
   - Workflow การเลือก Multi-select หลายแถว ➔ กด Bulk Reply ➔ ตรวจสอบ Timeline และ Queue
   - Workflow การปลดคำร้อง (Unlink) พร้อมกรอกเหตุผล
4. **Resilience & Concurrency Testing:**
   - ทดสอบเมื่อมีการยิง Bulk Update 100 รายการพร้อมกัน
   - ทดสอบ Debounce ใน Queue เมื่อมีข้อความไหลเข้ามาอย่างรวดเร็ว (Spam simulation)

---

## 2. รายละเอียด Test Cases ที่สำคัญ

### 2.1 Incident Core Management

| Test ID | Test Scenario | Steps | Expected Result |
|---------|---------------|-------|-----------------|
| **TC-INC-01** | สร้าง Incident ใหม่พร้อมเลือกเคสเริ่มต้น | 1. เลือก Report 2 เคส<br>2. กดสร้าง Incident พร้อมกรอกข้อมูลครบถ้วน | • Incident ถูกสร้างด้วยรหัส `INC-YYYYMMDD-NNN`<br>• `report_count` มีค่าเท่ากับ 2<br>• มี 2 records ใน `incident_reports` (`is_active = true`) |
| **TC-INC-02** | ป้องกันการผูก Report ซ้ำใน Incident เดียวกัน | 1. ผูก Report A เข้า Incident 1<br>2. พยายามเรียก API ผูก Report A เข้า Incident 1 อีกครั้ง | • เกิด DB Unique Violation หรือ API ส่งกลับ `409 Conflict`<br>• ไม่เกิด Record ขยะซ้ำซ้อน |
| **TC-INC-03** | การปลด Report ออกจาก Incident (Soft Remove) | 1. กดปุ่ม [ปลดออก] ที่ Report B<br>2. ระบุเหตุผล "ระบุตึกผิด"<br>3. กดยืนยัน | • `incident_reports.is_active` เปลี่ยนเป็น `false`<br>• มีค่า `removed_by`, `removed_reason` ครบถ้วน<br>• Trigger ปรับ `incidents.report_count` ลดลง 1 อัตโนมัติ<br>• Report B ยังคงอยู่ในระบบ ไม่ถูกลบ |
| **TC-INC-04** | การ Reopen Incident ที่ปิดไปแล้ว | 1. Incident สถานะ `closed`<br>2. เปลี่ยนสถานะกลับเป็น `in_progress` | • สถานะเปลี่ยนได้สำเร็จ<br>• บันทึกใน Timeline ว่าเป็นการ Reopen |

---

### 2.2 Bulk Actions

| Test ID | Test Scenario | Steps | Expected Result |
|---------|---------------|-------|-----------------|
| **TC-BLK-01** | Bulk Status Update สำเร็จทุกรายการ | 1. เลือก 5 คำร้องใน Incident<br>2. เปลี่ยนสถานะเป็น `resolved`<br>3. ใส่หมายเหตุ "ซ่อมเสร็จแล้ว" | • คำร้องทั้ง 5 รายการในตาราง `reports` มีสถานะ `resolved`<br>• ตาราง `report_logs` มี 5 แถวใหม่ที่ชี้มาที่ `bulk_action_id` เดียวกัน<br>• ตาราง `bulk_actions` บันทึก `success_count = 5`, `failed_count = 0` |
| **TC-BLK-02** | Bulk Action ทนทานต่อ Partial Failure | 1. สั่ง Bulk Update 10 รายการ โดยจงใจให้มี 1 รายการติด Database Lock | • รายการที่เหลือ 9 รายการอัปเดตสำเร็จ<br>• `bulk_actions.failed_count = 1`<br>• ระบบไม่ Rollback ทั้งหมดทิ้ง และแจ้งเตือนข้อผิดพลาดชัดเจน |
| **TC-BLK-03** | Bulk Reply สื่อสารหาประชาชน | 1. เลือก 3 คำร้อง<br>2. พิมพ์ข้อความตอบกลับ<br>3. ติ๊กส่งแจ้งเตือน | • มีประวัติ Reply ในแต่ละคำร้อง<br>• มี 3 รายการลงคิวใน `notification_queue` แยกรายบุคคล ไม่ปะปนกัน |

---

### 2.3 Matching & Suggestions Engine

| Test ID | Test Scenario | Input Data | Expected Result |
|---------|---------------|------------|-----------------|
| **TC-MTC-01** | คำร้องหมวดหมู่และสถานที่ตรงกันสูง | Category: กายภาพ, Loc: "หน้าตึก 1"<br>Incident: กายภาพ, Loc: "หน้าอาคาร 1" | • ได้คะแนนรวม $\ge 85$ คะแนน<br>• Confidence เป็น `HIGH`<br>• ปรากฏในแท็บ Suggestions ของ Incident นั้น |
| **TC-MTC-02** | คำร้องหมวดหมู่ต่างกันชัดเจน | Category: คอมพิวเตอร์/อินเทอร์เน็ต<br>Incident: ประปา/อาคาร | • ได้คะแนนหมวดหมู่เป็น 0<br>• ระบบตัดทิ้งทันที ไม่สร้าง Suggestion รบกวนเจ้าหน้าที่ |
| **TC-MTC-03** | กดยอมรับ Suggestion | กดปุ่ม [ยอมรับ] ในหน้ารายละเอียด | • Suggestion สถานะกลายเป็น `accepted`<br>• Report ถูกผูกเข้า Incident ทันที (`link_source = 'suggestion_accepted'`) |

---

### 2.4 Notifications & Debounce

| Test ID | Test Scenario | Steps | Expected Result |
|---------|---------------|-------|-----------------|
| **TC-NTF-01** | ส่งแจ้งเตือนคำร้องแรกทันที | สร้าง Incident ใหม่ที่มีความสำคัญสูง | • ส่งข้อความเข้ากลุ่ม LINE เจ้าหน้าที่ทันที 1 ข้อความ |
| **TC-NTF-02** | การ Debounce เมื่อมีคำร้องไหลเข้าต่อเนื่อง | มีคำร้องใหม่ผูกเข้า Incident เดิม 6 รายการ ภายใน 3 นาที | • ไม่มีเสียงเตือนรัว 6 ครั้ง<br>• ระบบรวบยอดส่งเพียง 1 ข้อความสรุป ("+6 คำร้องใหม่") เมื่อครบ 5 นาที |

---

### 2.5 Security & Permissions

| Test ID | Test Scenario | Role | Expected Result |
|---------|---------------|------|-----------------|
| **TC-SEC-01** | Viewer พยายามสร้าง Incident | `viewer` | • หน้าจอไม่มีปุ่มสร้าง Incident<br>• หากยิง API โดยตรงจะได้รับ `403 Forbidden` |
| **TC-SEC-02** | Staff ธรรมดาพยายาม Bulk Assign งาน | `staff` | • ได้รับแจ้งเตือนว่าสิทธิ์ไม่เพียงพอ (ต้องการระดับ `manager` ขึ้นไป) |

---

## 3. เกณฑ์การตรวจรับงาน (Definition of Done)

ระบบจะถือว่าพร้อมปล่อยสู่ Production เมื่อผ่านเกณฑ์ดังต่อไปนี้:
1. **Zero Data Regression:** ข้อมูลคำร้องเดิมทั้งหมดในตาราง `reports` และ `report_logs` ต้องไม่สูญหาย ไม่เพี้ยน และฟังก์ชันการรับเรื่องเดิมยังทำงานได้ 100%
2. **Automated Test Coverage:** Code coverage ของ Logic ใหม่ (Matching, Bulk Service, Queue Handler) $\ge 85\%$
3. **Audit Trail Completeness:** ทุกการกระทำแบบกลุ่ม (Bulk) และการผูก/ปลดคำร้อง สามารถตรวจสอบย้อนหลังได้ 100% ว่าใครทำ เมื่อไหร่ และทำไม
4. **Performance SLA:**
   - การเปิดหน้ารายการ Incident โหลดเสร็จภายใน $\le 1.5$ วินาที
   - การทำ Bulk Action กับ 50 รายการ ประมวลผลเสร็จสิ้นภายใน $\le 3$ วินาที
   - การตรวจจับ Similarity ใช้เวลาไม่เกิน 200ms ต่อคำร้อง
