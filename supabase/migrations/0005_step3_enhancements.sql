-- STEP 3 ENHANCEMENT: Automatic Incident Detection, Group Drafting & Priority Classification
-- Migration Document: 0005_step3_enhancements.sql
--
-- This migration documents:
-- 1. Priority Classification fields & constraints: 'emergency', 'normal', 'needs_review'
-- 2. Audit action types in report logs: 'priority_classified', 'priority_updated', 'draft_confirmed', 'draft_rejected'
-- 3. Incident Group priority support

-- 1. Indexing on priority column for both test_reports and reports
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority);
CREATE INDEX IF NOT EXISTS idx_test_reports_priority ON test_reports(priority);

-- 2. Add priority column to test_incident_groups and incident_groups if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_incident_groups' AND column_name = 'priority'
  ) THEN
    ALTER TABLE test_incident_groups ADD COLUMN priority text DEFAULT 'normal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'incident_groups' AND column_name = 'priority'
  ) THEN
    ALTER TABLE incident_groups ADD COLUMN priority text DEFAULT 'normal';
  END IF;
END $$;
