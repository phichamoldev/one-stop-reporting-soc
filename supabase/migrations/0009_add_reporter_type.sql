-- ============================================================================
-- MIGRATION: 0009_add_reporter_type.sql
-- PURPOSE: Add reporter_type column to reports and test_reports
-- Values: 'อาจารย์' | 'บุคลากร' | 'นิสิต'
-- ============================================================================

ALTER TABLE IF EXISTS test_reports ADD COLUMN IF NOT EXISTS reporter_type text;
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS reporter_type text;

