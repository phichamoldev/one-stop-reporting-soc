# Security & Access Control — Incident Grouping & Bulk Action

> **สถานะ: PLANNING ONLY — นโยบายความปลอดภัยและ RLS Policies สำหรับระบบ Incident Grouping**

---

## 1. การประเมินภัยคุกคาม (Threat Model & Key Risks)

| มิติความเสี่ยง | ภัยคุกคามที่เป็นไปได้ | มาตรการป้องกันในสถาปัตยกรรม |
|----------------|----------------------|-----------------------------|
| **1. Blast Radius** | บัญชีพนักงานถูกเจาะ แล้วสั่ง Bulk Action ปิดเรื่อง หรือส่งข้อความสแปมหาประชาชนจำนวนมาก | • จำกัดจำนวนคำร้องต่อการทำ Bulk Action สูงสุด 100 รายการ/ครั้ง<br>• ต้องมีบทบาทระดับ `manager` ขึ้นไปสำหรับการมอบหมายงานหรือปิดเรื่องจำนวนมาก<br>• มี Audit Log ผูก `bulk_action_id` ทุกการกระทำ |
| **2. Data Privacy (PDPA)** | เจ้าหน้าที่ส่งข้อความแบบกลุ่ม แล้วข้อมูลส่วนบุคคล (ชื่อ/เบอร์โทร) ของผู้แจ้ง A รั่วไหลไปยังผู้แจ้ง B | • ระบบส่งข้อความแบบแยกช่องทาง (Individual Delivery) โดยใช้เทมเพลตเดียวกันแต่ส่งแยกตาม User ID หรือ Report ID ห้ามส่งรวมกลุ่ม |
| **3. Privilege Escalation** | บุคคลภายนอกหรือผู้ใช้ทั่วไปเรียก API Incident หรือแอบดูข้อมูลการสืบสวนภายใน | • ปิดกั้น Endpoint `/api/incidents/*` และ `/api/bulk-actions/*` ด้วย Supabase Auth Session + RLS Policy อย่างเข้มงวด |
| **4. Queue Abuse / DoS** | ยิง Endpoint Process Queue ถี่ ๆ ทำให้ Server รับโหลดหนัก หรือ LINE Quota หมด | • คุ้มครอง Worker Route `/api/notifications/queue/process` ด้วย `CRON_SECRET` Header แบบ Secret Key |

---

## 2. Row Level Security (RLS) Policies

### 2.1 ตาราง `incidents`

```sql
-- เปิด RLS
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- 1. ดูรายการ Incident: เจ้าหน้าที่ทุกระดับ (Super Admin, Executive, Manager, Staff, Viewer)
CREATE POLICY "Staff can view incidents"
  ON incidents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

-- 2. สร้าง Incident: Super Admin, Manager, Staff
CREATE POLICY "Staff can insert incidents"
  ON incidents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_users 
      WHERE auth_user_id = auth.uid() 
        AND is_active = TRUE 
        AND role IN ('super_admin', 'manager', 'staff')
    )
  );

-- 3. แก้ไข Incident: Super Admin, Manager, หรือ Staff ที่ได้รับมอบหมาย
CREATE POLICY "Staff can update incidents"
  ON incidents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff_users 
      WHERE auth_user_id = auth.uid() 
        AND is_active = TRUE 
        AND (role IN ('super_admin', 'manager') OR incidents.assigned_to = auth.uid() OR incidents.created_by = auth.uid())
    )
  );
```

---

### 2.2 ตาราง `incident_reports` (ความสัมพันธ์ Report กับ Incident)

```sql
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

-- ดูการเชื่อมโยง: เจ้าหน้าที่ทุกคน
CREATE POLICY "Staff can view incident_reports"
  ON incident_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

-- เพิ่มคำร้องเข้า Incident: Staff, Manager, Super Admin
CREATE POLICY "Staff can insert incident_reports"
  ON incident_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_users 
      WHERE auth_user_id = auth.uid() 
        AND is_active = TRUE 
        AND role IN ('super_admin', 'manager', 'staff')
    )
  );

-- แก้ไข (เช่น ปลดออก soft-remove is_active=false): Staff, Manager, Super Admin
CREATE POLICY "Staff can update incident_reports"
  ON incident_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff_users 
      WHERE auth_user_id = auth.uid() 
        AND is_active = TRUE 
        AND role IN ('super_admin', 'manager', 'staff')
    )
  );
```

---

### 2.3 ตาราง `bulk_actions`

```sql
ALTER TABLE bulk_actions ENABLE ROW LEVEL SECURITY;

-- ดูประวัติ Bulk Action: เจ้าหน้าที่ทุกคน
CREATE POLICY "Staff can view bulk_actions"
  ON bulk_actions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

-- บันทึกการทำ Bulk Action: บันทึกได้เฉพาะผู้ที่ทำรายการจริง (performed_by = auth.uid())
CREATE POLICY "Staff can insert bulk_actions"
  ON bulk_actions FOR INSERT
  WITH CHECK (
    auth.uid() = performed_by AND
    EXISTS (
      SELECT 1 FROM staff_users 
      WHERE auth_user_id = auth.uid() 
        AND is_active = TRUE 
        AND role IN ('super_admin', 'manager', 'staff')
    )
  );
```

---

### 2.4 ตาราง `notification_queue`

```sql
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- อ่านและจัดการ Queue: เฉพาะ Service Role หรือ Super Admin
CREATE POLICY "Service role manages notification queue"
  ON notification_queue FOR ALL
  USING (
    auth.jwt()->>'role' = 'service_role' OR
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );
```

---

## 3. สิทธิ์การทำงานตามบทบาท (Role-Based Access Control)

| ความสามารถ (Capability) | Super Admin | Executive | Manager | Staff | Viewer |
|-------------------------|:-----------:|:---------:|:-------:|:-----:|:------:|
| ดูรายการ Incident | ✅ | ✅ | ✅ | ✅ | ✅ |
| สร้าง Incident ใหม่ | ✅ | ❌ | ✅ | ✅ | ❌ |
| แก้ไขข้อมูล Incident | ✅ | ❌ | ✅ | ✅ | ❌ |
| ผูกคำร้องเข้า Incident | ✅ | ❌ | ✅ | ✅ | ❌ |
| ปลดคำร้องออก (Unlink) | ✅ | ❌ | ✅ | ⚠️ *(ต้องระบุเหตุผล)* | ❌ |
| Bulk ตอบกลับประชาชน | ✅ | ❌ | ✅ | ✅ | ❌ |
| Bulk เปลี่ยนสถานะคำร้อง | ✅ | ❌ | ✅ | ✅ | ❌ |
| Bulk มอบหมายงานช่าง | ✅ | ❌ | ✅ | ❌ | ❌ |
| สั่งรันคิวแจ้งเตือนทันที | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 4. บันทึกประวัติและการตรวจสอบ (Audit Trail Requirements)

1. **ทุก Bulk Action ต้องบันทึกแบบ 2 ทอด:**
   - **ทอดที่ 1:** บันทึก 1 Master Record ใน `bulk_actions` (ระบุผู้ทำ, จำนวนที่เลือก, ผลลัพธ์สำเร็จ/ล้มเหลว)
   - **ทอดที่ 2:** บันทึกใน `report_logs` ของคำร้องย่อยทุกรายการ โดยมีฟิลด์ `bulk_action_id` อ้างอิงกลับมาที่ Master Record
2. **การปลดคำร้อง (Unlink Report):**
   - ห้ามลบแถวออกจากฐานข้อมูล (`DELETE` statement)
   - ใช้วิธี **Soft Remove** โดยปรับ `is_active = FALSE` พร้อมบันทึก `removed_by`, `removed_at`, และ `removed_reason` เสมอ
3. **การเข้าถึง Audit Log:**
   - หน้ารายละเอียด Incident ต้องมีแท็บแสดงประวัติการกระทำรวม (Bulk History) ให้เจ้าหน้าที่ตรวจสอบย้อนหลังได้ตลอดเวลา
