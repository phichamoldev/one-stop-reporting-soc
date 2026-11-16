-- STEP 1: Test Data Isolation Migration
-- Creates test_reports and test_report_logs with full isolation from production tables.

-- 1. Create Sequence for SOC-T-xxxxx Public IDs
CREATE SEQUENCE IF NOT EXISTS test_reports_public_id_seq START WITH 1 INCREMENT BY 1;

-- 2. Helper function to get next test public ID
CREATE OR REPLACE FUNCTION get_next_test_public_id()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'SOC-T-' || lpad(nextval('test_reports_public_id_seq')::text, 5, '0');
$$;

-- 3. Create test_reports table (mirroring reports structure)
CREATE TABLE IF NOT EXISTS test_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL DEFAULT ('SOC-T-' || lpad(nextval('test_reports_public_id_seq')::text, 5, '0')),
  tracking_token text NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  location text NOT NULL,
  description text NOT NULL,
  image_url text,
  reporter_name text NOT NULL,
  email text NOT NULL CHECK ((POSITION(('@'::text) IN (email)) > 1)),
  status text DEFAULT 'received'::text CHECK ((status = ANY (ARRAY['pending'::text, 'received'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text, 'cancelled'::text]))),
  priority text DEFAULT 'normal'::text,
  admin_remark text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  category_id integer REFERENCES categories(id),
  subcategory_id integer REFERENCES subcategories(id),
  phone character varying(20) NOT NULL,
  assigned_to uuid,
  completed_by uuid,
  completed_at timestamp with time zone
);

-- Indexes for test_reports
CREATE INDEX IF NOT EXISTS idx_test_reports_public_id ON test_reports(public_id);
CREATE INDEX IF NOT EXISTS idx_test_reports_status ON test_reports(status);
CREATE INDEX IF NOT EXISTS idx_test_reports_category_id ON test_reports(category_id);
CREATE INDEX IF NOT EXISTS idx_test_reports_created_at ON test_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_test_reports_phone ON test_reports(phone);

-- 4. Create test_report_logs table (mirroring report_logs structure)
-- CRITICAL: test_report_logs.report_id references test_reports.id ONLY (NO cross-table reference to reports)
CREATE TABLE IF NOT EXISTS test_report_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES staff_users(id),
  action character varying(100) NOT NULL,
  old_status character varying(50),
  new_status character varying(50),
  remark text,
  created_at timestamp with time zone DEFAULT now(),
  image_url text
);

-- Indexes for test_report_logs
CREATE INDEX IF NOT EXISTS idx_test_report_logs_report_id ON test_report_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_test_report_logs_user_id ON test_report_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_test_report_logs_created_at ON test_report_logs(created_at);

-- 5. Row Level Security (RLS)
ALTER TABLE test_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_report_logs ENABLE ROW LEVEL SECURITY;

-- Select policy for authenticated staff (mirroring reports)
CREATE POLICY "test_reports_select_policy" ON test_reports FOR SELECT TO authenticated USING (
  (EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid() AND (su.role)::text = ANY (ARRAY['admin'::text, 'super_admin'::text])))
  OR (EXISTS (SELECT 1 FROM ((staff_users su JOIN manager_departments md ON ((md.staff_user_id = su.id))) JOIN categories c ON ((c.department_id = md.department_id))) WHERE su.id = auth.uid() AND (su.role)::text = 'manager'::text AND c.id = test_reports.category_id))
  OR (EXISTS (SELECT 1 FROM (staff_users su JOIN categories c ON ((c.department_id = su.department_id))) WHERE su.id = auth.uid() AND (su.role)::text = 'staff'::text AND c.id = test_reports.category_id))
);

-- Deny direct public writes (enforcing server API usage via supabaseAdmin)
CREATE POLICY "deny_all_test_reports" ON test_reports FOR ALL TO public USING (false);
CREATE POLICY "deny_all_test_report_logs" ON test_report_logs FOR ALL TO public USING (false);

-- 6. Add test_reports to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE test_reports;
