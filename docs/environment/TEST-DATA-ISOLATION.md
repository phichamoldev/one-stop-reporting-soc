# สถาปัตยกรรมการแยกข้อมูลคำร้องสำหรับ Localhost (Test Data Isolation)

เอกสารนี้อธิบายรายละเอียดการแยก data source ระหว่าง Production และ Localhost / Development ตามมาตรฐาน **STEP 1** เพื่อให้ทีมพัฒนาสามารถทดสอบระบบ เพิ่ม/แก้ไข/ตรวจสอบคำร้อง ได้อย่างอิสระโดยไม่ส่งผลกระทบต่อข้อมูลหรือการดำเนินงานของ Production จริง

---

## 1. ตารางข้อมูลที่ใช้งาน (Data Sources)

| สภาพแวดล้อม (Environment) | ตารางคำร้องหลัก (Reports Table) | ตารางบันทึกประวัติ (Logs Table) |
| :--- | :--- | :--- |
| **Production** | `reports` | `report_logs` |
| **Localhost / Development** | `test_reports` | `test_report_logs` |

> [!IMPORTANT]
> - `test_report_logs.report_id` ทำการ Foreign Key ชี้ไปยัง `test_reports(id)` เท่านั้น
> - ไม่มีการสร้าง Foreign Key ข้ามระหว่าง Test Table และ Production Table อย่างเด็ดขาด

---

## 2. การแจ้งเตือน LINE Notification Routing

- **Production:** แจ้งเตือนไปยัง LINE กลุ่มของหน่วยงานที่รับผิดชอบตามการตั้งค่าปกติของ `departments`
- **Localhost / Test:** ทุกคำร้องที่เกิดขึ้นจาก Localhost จะถูก Route ไปยังกลุ่ม **"SOC TEST"** โดยอัตโนมัติ
  - **Dynamic Lookup:** ระบบจะค้นหา `line_group_id` ของหน่วยงาน `SOC TEST` (`code: 'soc-test'`) จากตาราง `departments` ในฐานข้อมูลโดยตรง โดยไม่มีการ hard-code LINE Group ID ในซอร์สโค้ด

---

## 3. รูปแบบ Public ID & Tracking Token

- **Production:**
  - รูปแบบเดิม `SOC-XXXXX` (สุ่มตัวเลข 5 หลัก เช่น `SOC-10523`)
  - Tracking Token: UUIDv4
- **Localhost / Test:**
  - รูปแบบ `SOC-T-00001`, `SOC-T-00002`, `SOC-T-00003`... (เพิ่มขึ้นตามลำดับ sequence)
  - ห้ามใช้ `SOC-TEST-` เพื่อให้ข้อมูลดูเป็นเลขคำร้องมาตรฐานสำหรับใช้ประกอบการนำเสนอ
  - Tracking Token: สร้างขึ้นแยกอิสระด้วย UUIDv4 ไม่ซ้ำและไม่ชนกับ Production

---

## 4. Production Safety Guard (ระบบป้องกันความปลอดภัย)

โมดูลกลาง `src/lib/dataSource.ts` มีระบบป้องกันความปลอดภัยแบบ **Fail-Fast**:
1. หากระบบตรวจพบว่ารันอยู่ใน Production (`VERCEL_ENV === 'production'`) แต่ถูกตั้งค่าให้ใช้ `REPORT_DATA_SOURCE=test` ระบบจะโยนข้อผิดพลาดระดับ Fatal Error และหยุดการทำงานทันที
2. ระบบไม่ยอมรับการเลือกตารางผ่าน Query Parameter เช่น `?table=test_reports` หรือ `?environment=production` เพื่อป้องกัน Client-side manipulation
3. ค่าเริ่มต้นสำหรับ Production จะล็อกที่ตาราง `reports` และ `report_logs` เสมอ

---

## 5. วิธีการตั้งค่าสำหรับ Localhost / Development

ในไฟล์ `.env.local`:

```env
# ตั้งค่า Data Source ให้ชี้ไปยังตารางทดสอบ
REPORT_DATA_SOURCE=test
NEXT_PUBLIC_REPORT_DATA_SOURCE=test
```

หากต้องการให้ Localhost กลับไปอ่าน Production ให้เปลี่ยนเป็น:
```env
REPORT_DATA_SOURCE=production
NEXT_PUBLIC_REPORT_DATA_SOURCE=production
```

---

## 6. Realtime Subscriptions

- **Production:** Realtime Subscription ฟังการเปลี่ยนแปลงที่ table `reports`
- **Localhost:** `RealtimeListener.tsx` ฟังการเปลี่ยนแปลงที่ table `test_reports` (ซึ่งลงทะเบียนใน `supabase_realtime` publication เรียบร้อยแล้ว) ทำให้ไม่เกิด event กวนกันข้ามสภาพแวดล้อม

---

## 7. Storage / รูปภาพ

- ไฟล์รูปภาพที่อัปโหลดผ่าน Localhost ในโหมดทดสอบจะถูกจัดเก็บใน Bucket `report-images` ภายใต้ prefix `test/` (เช่น `test/1749800000-xxxx.jpg`) เพื่อแยก namespace ออกจากรูปภาพจริงของ Production

---

## 8. วิธีตรวจสอบว่า Localhost ไม่ได้แตะต้อง Production

สามารถรันคำสั่ง SQL หรือสคริปต์ทดสอบเพื่อยืนยันว่าไม่มีการเปลี่ยนแปลงใน Production:

```sql
-- ตรวจสอบจำนวนแถวใน Production (ต้องไม่เปลี่ยนแปลงจากการทดสอบ)
SELECT count(*) FROM reports;
SELECT count(*) FROM report_logs;

-- ตรวจสอบข้อมูลในตารางทดสอบ
SELECT public_id, status, created_at FROM test_reports ORDER BY created_at DESC;
SELECT * FROM test_report_logs ORDER BY created_at DESC;
```

หรือรันสคริปต์อัตโนมัติ:
```bash
node scratch/test_isolation_flows.mjs
```

---

## 9. วิธี Rollback Migration

หากต้องการลบตารางทดสอบและฟังก์ชันทั้งหมดออกจากฐานข้อมูล:

```sql
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS test_reports;
DROP TABLE IF EXISTS test_report_logs CASCADE;
DROP TABLE IF EXISTS test_reports CASCADE;
DROP SEQUENCE IF EXISTS test_reports_public_id_seq CASCADE;
DROP FUNCTION IF EXISTS get_next_test_public_id();
```

---

## 10. ข้อจำกัดของ Test Environment

1. **Shared Metadata:** ตารางข้อมูลพื้นฐาน เช่น `categories`, `subcategories`, `departments`, `staff_users` ยังคงใช้ร่วมกับ Production เป็นข้อมูลอ้างอิง (Read-only สำหรับ report flow)
2. **Staff Assignment:** การมอบหมายงานให้กับเจ้าหน้าที่ใน `test_reports` ยังคงอ้างอิง user ID จาก `staff_users`
3. **Storage Bucket:** ใช้ Supabase Storage Bucket เดียวกัน (`report-images`) แต่แยก folder namespace ด้วย `test/`
