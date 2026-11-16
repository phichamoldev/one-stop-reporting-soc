-- STEP 6: Notification Logs Migration (Test & Production Tables)
-- Documents and establishes dedicated tables for tracking outbound LINE notifications,
-- status outcomes (sent, failed, skipped, blocked), delivery attempts, sanitized error codes,
-- and idempotency keys with full Test/Production isolation and RLS policies.

-- 1. TEST NOTIFICATION LOGS TABLE (Isolated for Localhost / Development)
CREATE TABLE IF NOT EXISTS test_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type character varying(100) NOT NULL,
  report_id uuid REFERENCES test_reports(id) ON DELETE SET NULL,
  public_id text,
  destination text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'skipped', 'blocked')),
  attempt_count integer NOT NULL DEFAULT 1,
  error_code text,
  error_message text,
  idempotency_key text,
  created_at timestamp with time zone DEFAULT now(),
  attempted_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_test_notif_logs_public_id ON test_notification_logs(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_notif_logs_idempotency_key ON test_notification_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_notif_logs_status ON test_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_test_notif_logs_created_at ON test_notification_logs(created_at);

-- 2. PRODUCTION NOTIFICATION LOGS TABLE (Mirrored for Production)
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type character varying(100) NOT NULL,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  public_id text,
  destination text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'skipped', 'blocked')),
  attempt_count integer NOT NULL DEFAULT 1,
  error_code text,
  error_message text,
  idempotency_key text,
  created_at timestamp with time zone DEFAULT now(),
  attempted_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_notif_logs_public_id ON notification_logs(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_logs_idempotency_key ON notification_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notif_logs_created_at ON notification_logs(created_at);

-- 3. Row Level Security (RLS)
ALTER TABLE test_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins/super_admins to inspect notification logs (Idempotent creation without dropping existing policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'test_notification_logs' 
      AND policyname = 'admin_select_test_notification_logs'
  ) THEN
    CREATE POLICY "admin_select_test_notification_logs" ON test_notification_logs FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid() AND (su.role)::text = ANY (ARRAY['admin'::text, 'super_admin'::text]))
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'notification_logs' 
      AND policyname = 'admin_select_notification_logs'
  ) THEN
    CREATE POLICY "admin_select_notification_logs" ON notification_logs FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid() AND (su.role)::text = ANY (ARRAY['admin'::text, 'super_admin'::text]))
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'test_notification_logs' 
      AND policyname = 'deny_public_test_notification_logs'
  ) THEN
    CREATE POLICY "deny_public_test_notification_logs" ON test_notification_logs FOR ALL TO public USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'notification_logs' 
      AND policyname = 'deny_public_notification_logs'
  ) THEN
    CREATE POLICY "deny_public_notification_logs" ON notification_logs FOR ALL TO public USING (false);
  END IF;
END $$;
