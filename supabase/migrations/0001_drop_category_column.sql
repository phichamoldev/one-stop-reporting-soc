-- Migration: Drop deprecated category column from reports table
-- Ensure all related code (API payloads, Track Page, LINE notifications)
-- have been updated to use category_id and subcategory_id relations before running this.

ALTER TABLE reports
DROP COLUMN category;
