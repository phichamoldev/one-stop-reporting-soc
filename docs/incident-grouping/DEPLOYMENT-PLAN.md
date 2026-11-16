# Deployment Plan & Release Strategy

> **สถานะ: PLANNING ONLY — แผนการปล่อยระบบ สภาพแวดล้อม Feature Flags และการควบคุมความเสี่ยง**

---

## 1. กลยุทธ์การปล่อยระบบ (Release Strategy: Phased Rollout)

เพื่อความมั่นใจสูงสุดว่าจะไม่กระทบต่อผู้ใช้งานทั่วไปและการรับเรื่องปกติ ระบบจะใช้แนวทาง **Dark Launch** และควบคุมด้วย **Feature Flags** แบ่งเป็น 4 ระยะ:

```
[Phase 0: DB Ready] ──> [Phase 1: Dark Launch] ──> [Phase 2: Pilot Users] ──> [Phase 3: Full GA]
  - Run Migrations       - Deploy Code (Off)        - Enable for Managers     - 100% All Staff
  - Verify Triggers      - Feature Flags = false     - Test with real cases    - Public alerts on
```

---

## 2. Feature Flags Configuration

กำหนดตัวแปรควบคุมในไฟล์ `.env` / Vercel Environment Variables:

| Flag Name | Default | คำอธิบาย |
|-----------|:-------:|----------|
| `FEATURE_INCIDENT_GROUPING` | `false` | เปิด/ปิด เมนู Incident และความสามารถในการจัดกลุ่ม |
| `FEATURE_BULK_ACTIONS` | `false` | เปิด/ปิด Floating Bar และการทำ Bulk Reply / Status |
| `FEATURE_SIMILARITY_SUGGESTIONS` | `false` | เปิด/ปิด การคำนวณและแสดงคำแนะนำเคสที่คล้ายกัน |
| `FEATURE_NOTIFICATION_DEBOUNCE` | `false` | เปิด/ปิด ระบบรวบยอดการแจ้งเตือน LINE |
| `CRON_SECRET` | - | Secret token สำหรับเรียก Route `/api/notifications/queue/process` |

---

## 3. ขั้นตอนการ Deploy ทีละเฟส (Execution Steps)

### เฟสที่ 1: Database Migration (Pre-deployment)
1. รัน Migration ตามคู่มือ [MIGRATION-PLAN.md](./MIGRATION-PLAN.md)
2. ตรวจสอบว่า Table, Trigger, RLS Policies พร้อมทำงาน
3. ยืนยันว่าระบบเดิมยังบันทึก `reports` และส่ง LINE ได้ปกติ

### เฟสที่ 2: Deploy Application Code (Dark Launch)
1. Deploy Next.js App Router ขึ้น Production โดยตั้งค่า Feature Flags ทุกตัวเป็น `false`
2. ตรวจสอบว่าหน้าจอเดิมของเจ้าหน้าที่ (`/backoffice/reports`) และหน้าประชาชนไม่มีอะไรเปลี่ยนแปลงหรือแสดงผลผิดพลาด

### เฟสที่ 3: เปิดทดสอบเฉพาะกลุ่ม (Pilot Testing - 1 สัปดาห์)
1. เปิด `FEATURE_INCIDENT_GROUPING=true` และ `FEATURE_BULK_ACTIONS=true` เฉพาะบัญชีบทบาท `super_admin` และ `manager` ที่ได้รับคัดเลือก
2. ทดลองสร้าง Incident จากเหตุการณ์จริง เช่น ท่อแตก หรือไฟดับ
3. สังเกตการณ์ประสิทธิภาพของ Database และดู Audit Logs ในการทำ Bulk Update

### เฟสที่ 4: เปิดใช้งานเต็มรูปแบบ (General Availability - GA)
1. เปิด Feature Flags ทุกตัวเป็น `true` ให้เจ้าหน้าที่ทุกคน
2. เปิดระบบ `FEATURE_NOTIFICATION_DEBOUNCE=true` พร้อมตั้งเวลางาน Cron ให้รันทุก 1-2 นาที

---

## 4. การตั้งค่าระบบ Background Worker (Notification Queue Runner)

ระบบต้องการ Cron Job สำหรับเคลียร์คิวและส่งสรุปการแจ้งเตือนทาง LINE โดยสามารถใช้:

### ตัวเลือกที่ 1: Vercel Cron Jobs (แนะนำ)
เพิ่มการตั้งค่าในไฟล์ `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/notifications/queue/process",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

### ตัวเลือกที่ 2: Supabase pg_cron + pg_net
เรียกยิง Webhook มาที่ Next.js API ทุก 1 นาที ผ่าน `pg_cron`

---

## 5. แผนรับมือเหตุฉุกเฉินและ Kill-Switch (Emergency Procedure)

หากเกิดปัญหาวิกฤตบน Production เช่น:
- LINE API ถูกยิงรัวจนโควตาเต็ม
- เกิด Deadlock หรือคิวค้างในระบบ

**ขั้นตอนการเปิดใช้ Kill-Switch ทันที:**
1. ปรับค่าใน Vercel Dashboard:
   - `FEATURE_INCIDENT_GROUPING=false`
   - `FEATURE_NOTIFICATION_DEBOUNCE=false`
2. กด Redeploy หรือ Promote การตั้งค่าใหม่ (ใช้เวลา $\le 60$ วินาที)
3. ระบบจะตัดกลับไปใช้ Flow การรับเรื่องและแจ้งเตือนทีละรายการแบบเดิมทันที โดยไม่ต้อง Rollback Database
