-- ============================================================================
-- MIGRATION: 0013_production_reports_schema_fix.sql
-- PURPOSE: Production Schema Compatibility for reports and test_reports
--          1. Add reporter_type column if not present
--          2. Drop NOT NULL constraint on location column
-- ============================================================================

-- 1. Add reporter_type column
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS reporter_type text;
ALTER TABLE IF EXISTS public.test_reports ADD COLUMN IF NOT EXISTS reporter_type text;

-- 2. Drop NOT NULL constraint on location
ALTER TABLE IF EXISTS public.reports ALTER COLUMN location DROP NOT NULL;
ALTER TABLE IF EXISTS public.test_reports ALTER COLUMN location DROP NOT NULL;

