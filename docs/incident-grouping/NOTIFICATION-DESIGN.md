# Notification Design — Queue, Debounce & Aggregation

> **สถานะ: PLANNING ONLY — ยังไม่มีการแก้ไขระบบส่ง LINE เดิม**

---

## 1. วัตถุประสงค์และปัญหาที่ต้องแก้

ในระบบเดิม เมื่อมีผู้แจ้งเรื่องเข้ามา ระบบจะส่งข้อความแจ้งเตือนผ่าน **LINE Messaging API** เข้ากลุ่มเจ้าหน้าที่ทันทีทีละข้อความ
- **ปัญหาเดิมเมื่อเกิด Incident ใหญ่ (เช่น ท่อประปาแตก, ไฟฟ้าดับทั้งอาคาร):**
  1. มีคนแจ้งเรื่องเดียวกัน 10–30 คนในเวลา 15 นาที
  2. กลุ่ม LINE เจ้าหน้าที่ถูก Spam ด้วยข้อความแจ้งเรื่องซ้ำ ๆ ทำให้ข้อความสำคัญอื่นถูกดันหาย
  3. เมื่อเจ้าหน้าที่อัปเดตสถานะ ถ้าต้องแจ้งเตือนกลับหาผู้แจ้งทุกคน อาจเจอปัญหา LINE API Rate Limit หรือ Network Timeout

---

## 2. สถาปัตยกรรมการแจ้งเตือนแบบใหม่

```
[ผู้แจ้งส่งคำร้อง] ───> [Report Inserted] ───> [Similarity Match Engine]
                                                        │
                      ┌─────────────────────────────────┴─────────────────┐
                      ▼                                                   ▼
             [เป็น Incident ใหม่]                               [เข้ากลุ่ม Incident เดิม]
                      │                                                   │
                      ▼                                                   ▼
            [สร้างคิวแจ้งเตือนทันที]                             [Queue พร้อม Debounce Key]
                      │                                                   │
                      │                                        (รอ 3-5 นาที รวบยอด)
                      ▼                                                   ▼
            [ส่ง LINE ทันที (Alert)]                            [ส่งสรุปยอดรวม (Aggregated)]
                      │                                                   │
                      └─────────────────┬─────────────────────────────────┘
                                        ▼
                            [Notification Worker]
                                        ▼
                            [LINE Messaging API]
```

---

## 3. กลยุทธ์ Debounce & Aggregation

### 3.1 สำหรับกลุ่ม LINE เจ้าหน้าที่ (Staff Group)
- **First-hit Alert:** เมื่อพบ Incident ใหม่ หรือคำร้องแรกที่กลายเป็น Incident ส่งแจ้งเตือนทันที (`send_after = NOW()`)
- **Debounce Window (5 นาที):** หากมีคำร้องใหม่ถูกผูกเข้า Incident เดียวกันภายใน 5 นาที:
  1. ไม่ออกข้อความใหม่ทีละอัน
  2. อัปเดต record ใน `notification_queue` โดยเพิ่มตัวนับ `accumulated_count`
  3. เลื่อนหรือคง `send_after = NOW() + 5 minutes`
- **Summary Digest Message:** เมื่อครบ 5 นาที Worker จะส่งข้อความสรุป 1 ข้อความ:
  > *"📢 **อัปเดตเหตุการณ์ INC-20260925-001** (ท่อประปาแตกตึก 1)*  
  > *มีผู้แจ้งเพิ่มอีก 5 รายการ ในช่วง 5 นาทีที่ผ่านมา (รวมทั้งหมด 8 รายการ)*  
  > *👉 [กดดูรายละเอียดเหตุการณ์ในระบบ]*"

### 3.2 สำหรับประชาชน/ผู้แจ้งเรื่อง (Citizen / Reporter)
- **รักษา Privacy & Individual Context:** ผู้แจ้งแต่ละคนจะได้รับข้อความเกี่ยวกับคำร้องของตนเองเสมอ (ระบุเลข `R2026xxxx-xxxx` ของตน) เพื่อไม่ให้สับสน
- **Bulk Status Dispatch:** เมื่อเจ้าหน้าที่กด Bulk Update "แก้ไขเสร็จสิ้น":
  - ระบบสร้าง Queue สำหรับผู้แจ้งแต่ละคน
  - Worker ทยอยส่งผ่าน LINE Push Message หรือใช้ **Multicast API** (หากกลุ่มผู้ใช้มี LINE User ID)
  - ไม่เปิดเผยชื่อหรือข้อมูลของผู้แจ้งรายอื่นในกลุ่มเดียวกัน

---

## 4. โครงสร้างตาราง Notification Queue

ดูรายละเอียดเชิงลึกใน [DATABASE-DESIGN.md](./DATABASE-DESIGN.md) ตาราง `notification_queue`:

- `debounce_key`: ตัวอย่าง `incident_update:INC-20260925-001:staff_group`
- `idempotency_key`: ตัวอย่าง `bulk_reply:ba-uuid-78:rep-uuid-1` (ป้องกันการส่งซ้ำกรณี retry)
- `max_attempts`: 3 ครั้ง (Exponential backoff: 30s, 2m, 10m)

---

## 5. LINE Flex Message Templates

### 5.1 Staff Incident Alert (เมื่อตรวจพบหรือสร้าง Incident ใหม่)

```json
{
  "type": "bubble",
  "header": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "🚨 INCIDENT ตรวจพบเหตุรวม",
        "weight": "bold",
        "color": "#EF4444",
        "size": "sm"
      },
      {
        "type": "text",
        "text": "ท่อประปาแตกหน้าอาคารเรียนรวม 1",
        "weight": "bold",
        "size": "lg",
        "margin": "xs",
        "wrap": true
      }
    ]
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "box",
        "layout": "baseline",
        "contents": [
          { "type": "text", "text": "รหัสเหตุการณ์:", "size": "sm", "color": "#6B7280", "flex": 3 },
          { "type": "text", "text": "INC-20260925-001", "size": "sm", "weight": "bold", "flex": 5 }
        ]
      },
      {
        "type": "box",
        "layout": "baseline",
        "contents": [
          { "type": "text", "text": "สถานที่:", "size": "sm", "color": "#6B7280", "flex": 3 },
          { "type": "text", "text": "หน้าอาคารเรียนรวม 1", "size": "sm", "flex": 5 }
        ]
      },
      {
        "type": "box",
        "layout": "baseline",
        "contents": [
          { "type": "text", "text": "จำนวนผู้แจ้ง:", "size": "sm", "color": "#6B7280", "flex": 3 },
          { "type": "text", "text": "3 รายการ (กำลังติดตาม)", "size": "sm", "weight": "bold", "color": "#F59E0B", "flex": 5 }
        ]
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "button",
        "action": {
          "type": "uri",
          "label": "ดูและจัดการ Incident",
          "uri": "https://reporting.soc.ac.th/backoffice/incidents/INC-20260925-001"
        },
        "style": "primary",
        "color": "#1E40AF"
      }
    ]
  }
}
```

---

### 5.2 Staff Aggregated Update (ข้อความสรุปเมื่อมีผู้แจ้งเรื่องเดิมเข้ามาเพิ่ม)

```json
{
  "type": "bubble",
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "📢 สรุปผู้แจ้งเพิ่มในเหตุการณ์",
        "weight": "bold",
        "size": "md",
        "color": "#2563EB"
      },
      {
        "type": "text",
        "text": "INC-20260925-001 (ท่อประปาแตกหน้าตึก 1)",
        "size": "sm",
        "color": "#4B5563",
        "margin": "xs"
      },
      {
        "type": "separator",
        "margin": "md"
      },
      {
        "type": "box",
        "layout": "vertical",
        "margin": "md",
        "contents": [
          {
            "type": "text",
            "text": "+5 คำร้องใหม่ ในรอบ 5 นาทีที่ผ่านมา",
            "weight": "bold",
            "size": "sm",
            "color": "#059669"
          },
          {
            "type": "text",
            "text": "ยอดรวมผู้แจ้งขณะนี้: 8 รายการ",
            "size": "xs",
            "color": "#6B7280",
            "margin": "xs"
          }
        ]
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "button",
        "action": {
          "type": "uri",
          "label": "เปิดหน้าควบคุมเหตุการณ์",
          "uri": "https://reporting.soc.ac.th/backoffice/incidents/INC-20260925-001"
        },
        "style": "secondary"
      }
    ]
  }
}
```

---

### 5.3 Citizen Notification (ส่งหาประชาชนเมื่อ Incident อัปเดตสถานะ)

```json
{
  "type": "bubble",
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "แจ้งเตือนสถานะคำร้องของท่าน",
        "weight": "bold",
        "size": "md",
        "color": "#111827"
      },
      {
        "type": "text",
        "text": "รหัสคำร้อง: R20260925-0012",
        "size": "xs",
        "color": "#6B7280",
        "margin": "xs"
      },
      {
        "type": "separator",
        "margin": "md"
      },
      {
        "type": "box",
        "layout": "vertical",
        "margin": "md",
        "contents": [
          {
            "type": "text",
            "text": "สถานะปัจจุบัน: แก้ไขเสร็จสิ้นแล้ว ✅",
            "weight": "bold",
            "size": "sm",
            "color": "#059669"
          },
          {
            "type": "text",
            "text": "ข้อความจากเจ้าหน้าที่: ทีมช่างดำเนินการซ่อมแซมจุดเชื่อมต่อท่อประปาและเปิดจ่ายน้ำตามปกติแล้ว ขอขอบคุณที่ช่วยแจ้งเหตุค่ะ",
            "size": "sm",
            "color": "#374151",
            "wrap": true,
            "margin": "sm"
          }
        ]
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "button",
        "action": {
          "type": "uri",
          "label": "ดูรายละเอียดและประเมินความพึงพอใจ",
          "uri": "https://reporting.soc.ac.th/reports/R20260925-0012"
        },
        "style": "primary",
        "color": "#059669"
      }
    ]
  }
}
```

---

## 6. ข้อกำหนดด้าน Reliability & Rate Limits

1. **LINE Messaging API Limits:**
   - Push Message Multicast: ส่งได้สูงสุดครั้งละ 500 User IDs ต่อ 1 Request
   - Rate limit ปลอดภัย: ไม่เกิน 50 requests/sec สำหรับ Standard tier
2. **Failure Handling:**
   - หาก LINE ตอบกลับ 429 (Too Many Requests) ให้บันทึก error และหน่วงเวลา (Backoff)
   - หากล้มเหลวครบ 3 ครั้ง ให้เปลี่ยนสถานะใน Queue เป็น `failed` และบันทึกข้อผิดพลาดใน `audit_logs`
3. **Graceful Fallback:**
   - หากระบบส่ง Notification ขัดข้อง ต้อง **ไม่ทำให้การบันทึกสถานะหรือ Bulk Action ใน Database ล้มเหลว** (Decoupled execution ผ่าน Queue)
