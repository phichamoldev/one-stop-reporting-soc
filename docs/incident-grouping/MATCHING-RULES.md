# Matching Rules & Detection Algorithm

> **สถานะ: PLANNING ONLY — กฎการจับคู่สำหรับการตรวจหาคำร้องที่เป็นเรื่องเดียวกัน (Phase 1: Rule-based + Trigram)**

---

## 1. ปรัชญาและแนวคิดการทำงาน (Core Philosophy)

1. **Human-in-the-loop เสมอ:** ระบบ Matching มีหน้าที่ค้นหาและ "แนะนำ (Suggest)" คำร้องที่น่าจะเป็นเรื่องเดียวกัน แต่ **เจ้าหน้าที่ (Staff) ต้องเป็นผู้กดยืนยัน (Accept) เข้ากลุ่มเสมอ** เพื่อป้องกัน False Positive
2. **Explainable AI / Scoring:** ทุกคำแนะนำต้องแจกแจงได้ว่าเหตุใดจึงได้คะแนนเท่านี้ (มีรายละเอียดเหตุผลใน JSON `match_reasons`)
3. **Additive & Safe:** การคำนวณ Matching จะสร้าง record ในตาราง `incident_suggestions` เท่านั้น ไม่มีการแก้ไขข้อมูลของคำร้องเดิมโดยพลการ

---

## 2. โมเดลการให้คะแนน (Scoring Model: เต็ม 100 คะแนน)

สูตรการคำนวณคะแนนความคล้ายคลึงระหว่าง คำร้องใหม่ ($R$) กับ Incident ที่กำลังเปิดอยู่ ($I$):

$$\text{Total Score} = S_{\text{category}} + S_{\text{subcategory}} + S_{\text{location}} + S_{\text{time}} + S_{\text{status\_bonus}}$$

### ตารางสัดส่วนคะแนน (Weight Distribution)

| ปัจจัย (Factor) | คะแนนเต็ม | วิธีการคิดคะแนน | เกณฑ์การให้คะแนน |
|-----------------|-----------|-----------------|------------------|
| **1. หมวดหมู่หลัก (Category)** | 40 | Exact Match | • ตรงกันเป๊ะ = **40**<br>• ไม่ตรงกัน = **0** *(Hard filter: หากหมวดหมู่ไม่ตรง จะตัดทิ้งทันที)* |
| **2. หมวดหมู่ย่อย (Subcategory)** | 15 | Exact Match | • ตรงกันเป๊ะ = **15**<br>• อันใดอันหนึ่งไม่ระบุ = **5**<br>• ระบุคนละตัว = **0** |
| **3. ความคล้ายของสถานที่ (Location)** | 25 | PostgreSQL `pg_trgm` | • `similarity(R.loc, I.loc) * 25`<br>• มีพจนานุกรมคำพ้อง (Synonyms) เช่น ตึก = อาคาร |
| **4. กรอบเวลาที่เกิดขึ้น (Time Window)** | 10 | ช่วงเวลาห่างกัน | • ภายใน 2 ชั่วโมง = **10**<br>• 2 - 6 ชั่วโมง = **7**<br>• 6 - 12 ชั่วโมง = **4**<br>• 12 - 24 ชั่วโมง = **2**<br>• เกิน 24 ชั่วโมง = **0** |
| **5. สถานะเหตุการณ์ (Status Bonus)** | 10 | Target Incident Status | • Incident อยู่ในสถานะ `open` หรือ `in_progress` = **10**<br>• สถานะอื่น = **0** |

---

## 3. ระดับความเชื่อมั่นและเกณฑ์การแสดงผล (Thresholds)

| ช่วงคะแนนรวม | ระดับความเชื่อมั่น (Confidence) | การกระทำของระบบ |
|--------------|--------------------------------|-----------------|
| **80 – 100 คะแนน** | **HIGH (ความเชื่อมั่นสูง)** | • สร้าง Record ใน `incident_suggestions`<br>• แสดงการ์ดสีเขียวเด่นในหน้า Incident Detail<br>• แสดง Badge แจ้งเตือนในหน้ารายการคำร้อง |
| **60 – 79 คะแนน** | **MEDIUM (ความเชื่อมั่นปานกลาง)** | • สร้าง Record ใน `incident_suggestions`<br>• แสดงการ์ดสีเหลืองในแท็บ "คำแนะนำอื่น ๆ" |
| **< 60 คะแนน** | **LOW (ต่ำเกินเกณฑ์)** | • ไม่สร้าง Suggestion หรือบันทึกเพื่อวิเคราะห์หลังบ้านเท่านั้น ไม่รบกวนหน้าจอเจ้าหน้าที่ |

---

## 4. การจัดการข้อความสถานที่ภาษาไทย (Thai Text Normalization)

สถานที่ในภาษาไทยมักมีคำฟุ่มเฟือยหรือการสะกดต่างกัน เช่น *"แถวๆ หน้าตึก 1"* กับ *"บริเวณหน้าอาคาร 1"*

### 4.1 ฟังก์ชัน Clean Text ก่อนคำนวณ Trigram:
1. **ตัดคำนำหน้าบอกตำแหน่งทั่วไป:**
   - `"บริเวณ"`, `"แถวๆ"`, `"ใกล้ๆ"`, `"หน้า"`, `"หลัง"`, `"ข้าง"`, `"ใน"`, `"นอก"`
2. **แปลงคำพ้อง (Synonym Normalization):**
   - `"ตึก"` ➔ `"อาคาร"`
   - `"วศ."` ➔ `"วิศวกรรมศาสตร์"`
   - `"รบ."` ➔ `"รัฐศาสตร์"`
   - `"ศศ."` ➔ `"ศิลปศาสตร์"`
   - `"ห้องน้ำ ช"` ➔ `"ห้องน้ำชาย"`
   - `"ห้องน้ำ ญ"` ➔ `"ห้องน้ำหญิง"`
3. **ตัดช่องว่างซ้ำซ้อน** และแปลงตัวพิมพ์เล็ก (Lowercasing ภาษาอังกฤษ/ตัวเลข)

---

## 5. PostgreSQL Query สำหรับคำนวณ Trigram Similarity

เมื่อเปิดใช้งาน Extension `pg_trgm`:

```sql
-- Query ตัวอย่างสำหรับค้นหา Incident ที่น่าจะตรงกับคำร้องที่เข้ามาใหม่
SELECT 
  i.id AS incident_id,
  i.public_id,
  i.title,
  i.category_id,
  i.location,
  -- คำนวณ Trigram similarity ของสถานที่
  similarity(COALESCE(i.location, ''), :report_location) AS loc_similarity,
  
  -- คะแนนหมวดหมู่
  CASE WHEN i.category_id = :report_category_id THEN 40 ELSE 0 END AS cat_score,
  
  -- คะแนนหมวดหมู่ย่อย
  CASE 
    WHEN i.subcategory_id = :report_subcategory_id THEN 15
    WHEN i.subcategory_id IS NULL OR :report_subcategory_id IS NULL THEN 5
    ELSE 0 
  END AS subcat_score,
  
  -- คะแนนสถานที่ (เต็ม 25)
  ROUND(similarity(COALESCE(i.location, ''), :report_location) * 25, 2) AS loc_score,
  
  -- คะแนนเวลา (เต็ม 10)
  CASE 
    WHEN NOW() - i.created_at <= INTERVAL '2 hours' THEN 10
    WHEN NOW() - i.created_at <= INTERVAL '6 hours' THEN 7
    WHEN NOW() - i.created_at <= INTERVAL '12 hours' THEN 4
    WHEN NOW() - i.created_at <= INTERVAL '24 hours' THEN 2
    ELSE 0 
  END AS time_score,
  
  -- คะแนนสถานะ (เต็ม 10)
  CASE WHEN i.status IN ('open', 'in_progress') THEN 10 ELSE 0 END AS status_bonus

FROM incidents i
WHERE i.status IN ('open', 'in_progress')
  AND i.category_id = :report_category_id
ORDER BY (
  (CASE WHEN i.category_id = :report_category_id THEN 40 ELSE 0 END) +
  (CASE WHEN i.subcategory_id = :report_subcategory_id THEN 15 ELSE 5 END) +
  (similarity(COALESCE(i.location, ''), :report_location) * 25) +
  (CASE WHEN NOW() - i.created_at <= INTERVAL '2 hours' THEN 10 ELSE 0 END) +
  10
) DESC
LIMIT 5;
```

---

## 6. โครงสร้าง JSON ของ Match Reasons

ตัวอย่าง JSON ที่จัดเก็บในคอลัมน์ `incident_suggestions.match_reasons`:

```json
{
  "total_score": 88.5,
  "confidence": "HIGH",
  "evaluated_at": "2026-09-25T09:21:00Z",
  "factors": [
    {
      "name": "category",
      "label": "หมวดหมู่หลักตรงกัน",
      "matched": true,
      "score": 40,
      "max_score": 40,
      "evidence": "กายภาพและสิ่งแวดล้อม"
    },
    {
      "name": "subcategory",
      "label": "หมวดหมู่ย่อยตรงกัน",
      "matched": true,
      "score": 15,
      "max_score": 15,
      "evidence": "ท่อประปา/น้ำรั่ว"
    },
    {
      "name": "location",
      "label": "สถานที่ใกล้เคียงกันสูง",
      "score": 23.5,
      "max_score": 25,
      "raw_similarity": 0.94,
      "evidence": "หน้าอาคารเรียนรวม 1 vs ลานจอดรถหน้าอาคารเรียนรวม 1"
    },
    {
      "name": "time_window",
      "label": "เวลาแจ้งห่างกันไม่เกิน 2 ชม.",
      "score": 10,
      "max_score": 10,
      "evidence": "แจ้งห่างกัน 48 นาที"
    },
    {
      "name": "status_bonus",
      "label": "เหตุการณ์อยู่ในระหว่างดำเนินการ",
      "score": 0,
      "max_score": 10,
      "evidence": "สถานะ Incident คือ in_progress"
    }
  ]
}
```

---

## 7. แผนต่อยอดใน Phase 2 (AI Semantic Embedding)

เมื่อระบบ Phase 1 มีการใช้งานและจัดเก็บข้อมูลอย่างน้อย 3-6 เดือน จะนำ AI Semantic Matching เข้ามาเสริม:
1. **Vector Embedding:** ใช้โมเดล `text-embedding-3-small` ของ OpenAI ร่วมกับ Extension `pgvector`
2. **จับความหมายคล้ายคลึง:** เช่น คำร้อง *"แอร์น้ำหยด"* กับ *"เครื่องปรับอากาศมีน้ำรั่วไหลนองพื้น"* ถึงคำสะกดจะไม่เหมือนกัน แต่ Vector Similarity จะได้คะแนนสูงเกิน 0.85 ทันที
