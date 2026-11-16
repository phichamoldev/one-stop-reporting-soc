-- Make location column optional on reports and test_reports
ALTER TABLE reports ALTER COLUMN location DROP NOT NULL;
ALTER TABLE test_reports ALTER COLUMN location DROP NOT NULL;

