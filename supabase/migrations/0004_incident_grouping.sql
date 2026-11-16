-- STEP 3: Incident Grouping Migration (Test & Production Tables)

-- 1. Create Sequences
CREATE SEQUENCE IF NOT EXISTS test_incident_groups_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS incident_groups_seq START WITH 1 INCREMENT BY 1;

-- 2. Helper functions for Group Codes
CREATE OR REPLACE FUNCTION get_next_test_incident_group_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'INC-T-' || lpad(nextval('test_incident_groups_seq')::text, 5, '0');
$$;

CREATE OR REPLACE FUNCTION get_next_incident_group_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'INC-' || lpad(nextval('incident_groups_seq')::text, 5, '0');
$$;

-- 3. TEST TABLES (Isolated for Localhost / Development)
CREATE TABLE IF NOT EXISTS test_incident_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code text NOT NULL UNIQUE DEFAULT ('INC-T-' || lpad(nextval('test_incident_groups_seq')::text, 5, '0')),
  title text NOT NULL,
  description text,
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_incident_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES test_incident_groups(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
  added_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  added_at timestamp with time zone DEFAULT now(),
  notes text,
  CONSTRAINT uq_test_incident_group_members_group_report UNIQUE (group_id, report_id)
);

CREATE TABLE IF NOT EXISTS test_incident_group_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES test_incident_groups(id) ON DELETE CASCADE,
  report_id uuid REFERENCES test_reports(id) ON DELETE SET NULL,
  action character varying(100) NOT NULL,
  actor_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  actor_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for Test Tables
CREATE INDEX IF NOT EXISTS idx_test_incident_groups_code ON test_incident_groups(group_code);
CREATE INDEX IF NOT EXISTS idx_test_incident_groups_status ON test_incident_groups(status);
CREATE INDEX IF NOT EXISTS idx_test_incident_groups_created_at ON test_incident_groups(created_at);
CREATE INDEX IF NOT EXISTS idx_test_incident_group_members_group_id ON test_incident_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_test_incident_group_members_report_id ON test_incident_group_members(report_id);
CREATE INDEX IF NOT EXISTS idx_test_incident_group_history_group_id ON test_incident_group_history(group_id);

-- 4. PRODUCTION TABLES (Mirrored structure for Production)
CREATE TABLE IF NOT EXISTS incident_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code text NOT NULL UNIQUE DEFAULT ('INC-' || lpad(nextval('incident_groups_seq')::text, 5, '0')),
  title text NOT NULL,
  description text,
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES incident_groups(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  added_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  added_at timestamp with time zone DEFAULT now(),
  notes text,
  CONSTRAINT uq_incident_group_members_group_report UNIQUE (group_id, report_id)
);

CREATE TABLE IF NOT EXISTS incident_group_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES incident_groups(id) ON DELETE CASCADE,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  action character varying(100) NOT NULL,
  actor_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  actor_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for Production Tables
CREATE INDEX IF NOT EXISTS idx_incident_groups_code ON incident_groups(group_code);
CREATE INDEX IF NOT EXISTS idx_incident_groups_status ON incident_groups(status);
CREATE INDEX IF NOT EXISTS idx_incident_groups_created_at ON incident_groups(created_at);
CREATE INDEX IF NOT EXISTS idx_incident_group_members_group_id ON incident_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_incident_group_members_report_id ON incident_group_members(report_id);
CREATE INDEX IF NOT EXISTS idx_incident_group_history_group_id ON incident_group_history(group_id);

-- 5. Row Level Security (RLS)
ALTER TABLE test_incident_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_incident_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_incident_group_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE incident_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_group_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with staff profile to SELECT
CREATE POLICY "test_incident_groups_select" ON test_incident_groups FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid())
);
CREATE POLICY "test_incident_group_members_select" ON test_incident_group_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid())
);
CREATE POLICY "test_incident_group_history_select" ON test_incident_group_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid())
);

CREATE POLICY "incident_groups_select" ON incident_groups FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid())
);
CREATE POLICY "incident_group_members_select" ON incident_group_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid())
);
CREATE POLICY "incident_group_history_select" ON incident_group_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid())
);

-- Deny public writes
CREATE POLICY "deny_all_test_incident_groups" ON test_incident_groups FOR ALL TO public USING (false);
CREATE POLICY "deny_all_test_incident_group_members" ON test_incident_group_members FOR ALL TO public USING (false);
CREATE POLICY "deny_all_test_incident_group_history" ON test_incident_group_history FOR ALL TO public USING (false);

CREATE POLICY "deny_all_incident_groups" ON incident_groups FOR ALL TO public USING (false);
CREATE POLICY "deny_all_incident_group_members" ON incident_group_members FOR ALL TO public USING (false);
CREATE POLICY "deny_all_incident_group_history" ON incident_group_history FOR ALL TO public USING (false);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE test_incident_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE incident_groups;
