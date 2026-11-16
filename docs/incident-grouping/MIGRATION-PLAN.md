# Database Migration & Rollback Strategy

> **สถานะ: PLANNING ONLY — คู่มือการรัน Migration และขั้นตอน Rollback สำหรับ Production Database**

---

## 1. หลักการสำคัญ (Zero-Downtime & Additive-Only)

1. **ไม่แตะต้องโครงสร้าง Table เดิมที่เป็น Core Data:** ตาราง `reports` จะไม่มีการ Alter หรือเพิ่ม Foreign Key เข้าไปโดยตรง ทำให้ระบบรับเรื่องผ่านฟอร์มหน้าเว็บและ LINE Bot เดิมสามารถรับเรื่องต่อได้ 100% แม้ขณะกำลังรัน Migration
2. **Nullable Columns Only:** สำหรับตาราง `report_logs` และ `audit_logs` จะเพิ่มเฉพาะคอลัมน์ที่เป็น Nullable (`bulk_action_id`, `incident_id`) เท่านั้น จึงไม่มีผลกระทบต่อคำสั่ง INSERT/UPDATE เดิมของระบบ
3. **Rollback Ready:** ทุกขั้นตอนจะมีคำสั่ง Reverse/Rollback SQL เตรียมไว้ชัดเจน สามารถย้อนกลับได้ภายในเวลาไม่เกิน 60 วินาที

---

## 2. ขั้นตอนการเตรียมการ (Pre-Migration Checklist)

- [ ] 1. สร้าง Supabase Database Backup Snapshot หรือรัน `pg_dump` สำรองข้อมูลทั้งหมด
- [ ] 2. ตรวจสอบว่าไม่มี Long-running transaction หรือ Database Lock ค้างอยู่ในระบบ
- [ ] 3. ตรวจสอบสิทธิ์ผู้รันว่ามีบทบาท `postgres` หรือ `service_role`
- [ ] 4. เตรียมรัน Migration ในช่วงเวลา Low-traffic (เช่น ช่วง 22:00 - 05:00 น.)

---

## 3. ลำดับไฟล์และคำสั่ง Migration (Step-by-Step SQL)

### ขั้นตอนที่ 1: เปิดใช้งาน Extensions
**ไฟล์:** `supabase/migrations/20260925000001_enable_trgm.sql`

```sql
-- Migration: Enable pg_trgm for text similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```
*Rollback:* `DROP EXTENSION IF EXISTS pg_trgm;`

---

### ขั้นตอนที่ 2: สร้าง Sequence และ Tables ใหม่
**ไฟล์:** `supabase/migrations/20260925000002_create_incident_tables.sql`

```sql
-- 1. Sequence สำหรับรหัส Incident
CREATE SEQUENCE IF NOT EXISTS incident_daily_seq;

-- 2. Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       TEXT        NOT NULL UNIQUE,
  title           TEXT        NOT NULL,
  description     TEXT,
  category_id     INTEGER     REFERENCES categories(id),
  subcategory_id  INTEGER     REFERENCES subcategories(id),
  location        TEXT,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority        TEXT        NOT NULL DEFAULT 'normal'
                              CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  created_by      UUID        REFERENCES auth.users(id),
  assigned_to     UUID        REFERENCES auth.users(id),
  report_count    INTEGER     NOT NULL DEFAULT 0,
  last_notified_at          TIMESTAMPTZ,
  last_notification_count   INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_category_id ON incidents(category_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);

-- 3. Incident Reports Mapping Table
CREATE TABLE IF NOT EXISTS incident_reports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  report_id       UUID        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  linked_by       UUID        REFERENCES auth.users(id),
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  link_source     TEXT        NOT NULL DEFAULT 'manual'
                              CHECK (link_source IN ('manual', 'suggestion_accepted', 'auto')),
  removed_by      UUID        REFERENCES auth.users(id),
  removed_at      TIMESTAMPTZ,
  removed_reason  TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_incident_report UNIQUE (incident_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_ir_incident_active ON incident_reports(incident_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ir_report_active ON incident_reports(report_id) WHERE is_active = TRUE;

-- 4. Incident Suggestions Table
CREATE TABLE IF NOT EXISTS incident_suggestions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  incident_id     UUID        REFERENCES incidents(id) ON DELETE CASCADE,
  match_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
  match_reasons   JSONB,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  decided_by      UUID        REFERENCES auth.users(id),
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_suggestions_pending ON incident_suggestions(status) WHERE status = 'pending';

-- 5. Bulk Actions Table
CREATE TABLE IF NOT EXISTS bulk_actions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type     TEXT        NOT NULL
                              CHECK (action_type IN ('bulk_reply', 'bulk_status', 'bulk_assign', 'bulk_group')),
  performed_by    UUID        NOT NULL REFERENCES auth.users(id),
  incident_id     UUID        REFERENCES incidents(id),
  new_status      TEXT,
  message         TEXT,
  assigned_to     UUID        REFERENCES auth.users(id),
  report_ids      UUID[]      NOT NULL,
  report_count    INTEGER     NOT NULL DEFAULT 0,
  success_count   INTEGER     DEFAULT 0,
  failed_count    INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Notification Queue Table
CREATE TABLE IF NOT EXISTS notification_queue (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT        NOT NULL,
  report_id         UUID        REFERENCES reports(id) ON DELETE SET NULL,
  incident_id       UUID        REFERENCES incidents(id) ON DELETE SET NULL,
  bulk_action_id    UUID        REFERENCES bulk_actions(id) ON DELETE SET NULL,
  line_group_id     TEXT        NOT NULL,
  payload           JSONB       NOT NULL,
  debounce_key      TEXT,
  send_after        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count     INTEGER     NOT NULL DEFAULT 0,
  max_attempts      INTEGER     NOT NULL DEFAULT 3,
  last_error        TEXT,
  idempotency_key   TEXT        UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nq_pending ON notification_queue(send_after) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_nq_debounce ON notification_queue(debounce_key) WHERE debounce_key IS NOT NULL AND status = 'pending';
```

---

### ขั้นตอนที่ 3: เพิ่มคอลัมน์ในตารางเดิม (Additive Column Alterations)
**ไฟล์:** `supabase/migrations/20260925000003_alter_existing_tables.sql`

```sql
-- เพิ่ม bulk_action_id ใน report_logs
ALTER TABLE report_logs 
  ADD COLUMN IF NOT EXISTS bulk_action_id UUID REFERENCES bulk_actions(id);

CREATE INDEX IF NOT EXISTS idx_rl_bulk_action ON report_logs(bulk_action_id) WHERE bulk_action_id IS NOT NULL;

-- เพิ่ม bulk_action_id และ incident_id ใน audit_logs
ALTER TABLE audit_logs 
  ADD COLUMN IF NOT EXISTS bulk_action_id UUID REFERENCES bulk_actions(id),
  ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES incidents(id);
```

---

### ขั้นตอนที่ 4: สร้าง Functions และ Triggers
**ไฟล์:** `supabase/migrations/20260925000004_create_triggers_functions.sql`

```sql
-- Trigger updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Trigger sync count
CREATE OR REPLACE FUNCTION sync_incident_report_count()
RETURNS TRIGGER AS $$
DECLARE
  target_incident_id UUID;
BEGIN
  target_incident_id := COALESCE(NEW.incident_id, OLD.incident_id);
  UPDATE incidents 
  SET report_count = (
    SELECT COUNT(*) FROM incident_reports 
    WHERE incident_id = target_incident_id AND is_active = TRUE
  ),
  updated_at = NOW()
  WHERE id = target_incident_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_report_count
  AFTER INSERT OR UPDATE OF is_active ON incident_reports
  FOR EACH ROW EXECUTE FUNCTION sync_incident_report_count();
```

---

## 4. แผนการย้อนกลับฉุกเฉิน (Emergency Rollback Plan)

หากพบปัญหาไม่คาดคิด ให้รันคำสั่งย้อนกลับเรียงตามลำดับดังนี้:

```sql
-- ROLLBACK SCRIPT (Run only if critical issue arises)

-- 1. ลบ Triggers และ Functions
DROP TRIGGER IF EXISTS trg_sync_report_count ON incident_reports;
DROP FUNCTION IF EXISTS sync_incident_report_count();
DROP TRIGGER IF EXISTS trg_incidents_updated_at ON incidents;
DROP FUNCTION IF EXISTS trigger_set_updated_at();

-- 2. ถอด Column ที่เพิ่มในตารางเดิมออก
ALTER TABLE report_logs DROP COLUMN IF EXISTS bulk_action_id;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS bulk_action_id;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS incident_id;

-- 3. ลบ Tables ใหม่ (ไม่กระทบ reports เดิม)
DROP TABLE IF EXISTS notification_queue CASCADE;
DROP TABLE IF EXISTS incident_suggestions CASCADE;
DROP TABLE IF EXISTS incident_reports CASCADE;
DROP TABLE IF EXISTS bulk_actions CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;

-- 4. ลบ Sequence
DROP SEQUENCE IF EXISTS incident_daily_seq;
```

---

## 5. การตรวจสอบความสมบูรณ์หลัง Migration (Verification Script)

```sql
-- รันเพื่อตรวจสอบว่าทุกตารางและฟังก์ชันพร้อมใช้งาน
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('incidents', 'incident_reports', 'incident_suggestions', 'bulk_actions', 'notification_queue')
ORDER BY table_name, ordinal_position;

-- ตรวจสอบ Triggers
SELECT tgname, relname 
FROM pg_trigger t 
JOIN pg_class c ON t.tgrelid = c.oid 
WHERE tgname IN ('trg_incidents_updated_at', 'trg_sync_report_count');
```
