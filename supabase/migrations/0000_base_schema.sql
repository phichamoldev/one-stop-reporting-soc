-- ============================================================================
-- MIGRATION 0000: BASE SCHEMA DEFINITION (PRE-MIGRATION FOUNDATION)
-- File: supabase/migrations/0000_base_schema.sql
-- Purpose: Provides the core baseline tables required by Migrations 0001-0007
-- Note: Reconstructed strictly from live database schema evidence (ARCHITECTURE.md
--       Section 1.3-1.9, 0003_test_data_isolation.sql mirror, and application models)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS & METADATA
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS departments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text UNIQUE,
  name_th text NOT NULL,
  line_group_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);

CREATE TABLE IF NOT EXISTS categories (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text UNIQUE,
  name_th text NOT NULL,
  department_id integer REFERENCES departments(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code);
CREATE INDEX IF NOT EXISTS idx_categories_dept_id ON categories(department_id);

CREATE TABLE IF NOT EXISTS subcategories (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id integer NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name_th text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subcategories_cat_id ON subcategories(category_id);

-- ----------------------------------------------------------------------------
-- 2. STAFF USERS & PERMISSIONS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text NOT NULL,
  department_id integer REFERENCES departments(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'staff')),
  status varchar DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_users_auth ON staff_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_role ON staff_users(role);
CREATE INDEX IF NOT EXISTS idx_staff_users_dept ON staff_users(department_id);

CREATE TABLE IF NOT EXISTS manager_departments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  department_id integer NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT uq_manager_departments UNIQUE (staff_user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_mgr_depts_staff ON manager_departments(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_mgr_depts_dept ON manager_departments(department_id);

-- ----------------------------------------------------------------------------
-- 3. REPORTS & AUDIT LOGS
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS reports_public_id_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION get_next_public_id()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'SOC-' || lpad(nextval('reports_public_id_seq')::text, 5, '0');
$$;

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('SOC-' || lpad(nextval('reports_public_id_seq')::text, 5, '0')),
  tracking_token text NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  location text NOT NULL,
  description text NOT NULL,
  image_url text,
  reporter_name text NOT NULL,
  email text NOT NULL CHECK ((POSITION(('@'::text) IN (email)) > 1)),
  phone character varying(20) NOT NULL,
  status text DEFAULT 'received'::text CHECK (status IN ('pending', 'received', 'in_progress', 'completed', 'rejected', 'cancelled')),
  priority text DEFAULT 'normal'::text,
  admin_remark text,
  category text,                                                -- Legacy column dropped in Migration 0001
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id integer REFERENCES subcategories(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_public_id ON reports(public_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category_id ON reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_phone ON reports(phone);

CREATE TABLE IF NOT EXISTS report_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  action character varying(100) NOT NULL,
  old_status character varying(50),
  new_status character varying(50),
  remark text,
  image_url text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_logs_report_id ON report_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_report_logs_user_id ON report_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_report_logs_created_at ON report_logs(created_at);

-- ----------------------------------------------------------------------------
-- 4. BASE ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_logs ENABLE ROW LEVEL SECURITY;

-- Deny public direct access by default (enforce trusted server API execution)
DROP POLICY IF EXISTS "deny_all_departments" ON departments;
CREATE POLICY "deny_all_departments" ON departments FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "deny_all_categories" ON categories;
CREATE POLICY "deny_all_categories" ON categories FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "deny_all_subcategories" ON subcategories;
CREATE POLICY "deny_all_subcategories" ON subcategories FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "deny_all_staff_users" ON staff_users;
CREATE POLICY "deny_all_staff_users" ON staff_users FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "deny_all_reports" ON reports;
CREATE POLICY "deny_all_reports" ON reports FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "deny_all_report_logs" ON report_logs;
CREATE POLICY "deny_all_report_logs" ON report_logs FOR ALL TO public USING (false);

-- Authenticated Staff Access Policies
DROP POLICY IF EXISTS "staff_select_departments" ON departments;
CREATE POLICY "staff_select_departments" ON departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_select_categories" ON categories;
CREATE POLICY "staff_select_categories" ON categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_select_subcategories" ON subcategories;
CREATE POLICY "staff_select_subcategories" ON subcategories FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_active_staff(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_users 
    WHERE id = user_id AND status = 'active'
  );
$$;

DROP POLICY IF EXISTS "staff_select_staff_users" ON staff_users;
CREATE POLICY "staff_select_staff_users" ON staff_users FOR SELECT TO authenticated USING (
  public.is_active_staff(auth.uid())
);

DROP POLICY IF EXISTS "reports_select_policy" ON reports;
CREATE POLICY "reports_select_policy" ON reports FOR SELECT TO authenticated USING (
  (EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid() AND (su.role)::text = ANY (ARRAY['admin'::text, 'super_admin'::text])))
  OR (EXISTS (SELECT 1 FROM ((staff_users su JOIN manager_departments md ON ((md.staff_user_id = su.id))) JOIN categories c ON ((c.department_id = md.department_id))) WHERE su.id = auth.uid() AND (su.role)::text = 'manager'::text AND c.id = reports.category_id))
  OR (EXISTS (SELECT 1 FROM (staff_users su JOIN categories c ON ((c.department_id = su.department_id))) WHERE su.id = auth.uid() AND (su.role)::text = 'staff'::text AND c.id = reports.category_id))
);

DROP POLICY IF EXISTS "manager_departments_select" ON manager_departments;
CREATE POLICY "manager_departments_select" ON manager_departments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM staff_users su 
    WHERE su.id = auth.uid() 
      AND (su.role IN ('admin', 'super_admin') OR su.id = manager_departments.staff_user_id)
  )
);

