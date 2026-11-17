-- ============================================================================
-- MIGRATION: 0012_production_notification_tables.sql
-- PURPOSE: Idempotent Setup of Notification Logs, Event Trackers & Outbox
--          for Production & Test Environments (Fail-Safe & Idempotent)
-- ============================================================================

-- 1. NOTIFICATION LOGS (Production & Test)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type character varying(100) NOT NULL,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_notif_logs_public_id ON public.notification_logs(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_logs_idempotency_key ON public.notification_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON public.notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notif_logs_created_at ON public.notification_logs(created_at);

CREATE TABLE IF NOT EXISTS public.test_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type character varying(100) NOT NULL,
  report_id uuid REFERENCES public.test_reports(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_test_notif_logs_public_id ON public.test_notification_logs(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_notif_logs_idempotency_key ON public.test_notification_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_notif_logs_status ON public.test_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_test_notif_logs_created_at ON public.test_notification_logs(created_at);

-- 2. EVENT NOTIFICATION TRACKERS (Production & Test)
CREATE TABLE IF NOT EXISTS public.event_notification_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL UNIQUE,
  cluster_signature text NOT NULL,
  primary_group_hint text,
  category_id integer REFERENCES public.categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  location text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency', 'normal', 'needs_review')),
  escalation_version integer NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'NEW',
  initial_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  initial_report_public_id text,
  destination text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  window_started_at timestamp with time zone DEFAULT now(),
  window_expires_at timestamp with time zone NOT NULL,
  total_report_count integer NOT NULL DEFAULT 1,
  last_notified_count integer NOT NULL DEFAULT 1,
  digest_sequence integer NOT NULL DEFAULT 0,
  digest_claimed_by text,
  digest_claimed_at timestamp with time zone,
  last_notified_at timestamp with time zone,
  first_alert_sent_at timestamp with time zone,
  last_update_sent_at timestamp with time zone,
  next_update_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evt_trackers_sig ON public.event_notification_trackers(cluster_signature) WHERE state NOT IN ('CLOSED');
CREATE INDEX IF NOT EXISTS idx_evt_trackers_state ON public.event_notification_trackers(state);

CREATE TABLE IF NOT EXISTS public.test_event_notification_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL UNIQUE,
  cluster_signature text NOT NULL,
  primary_group_hint text,
  category_id integer REFERENCES public.categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  location text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency', 'normal', 'needs_review')),
  escalation_version integer NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'NEW',
  initial_report_id uuid REFERENCES public.test_reports(id) ON DELETE SET NULL,
  initial_report_public_id text,
  destination text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  window_started_at timestamp with time zone DEFAULT now(),
  window_expires_at timestamp with time zone NOT NULL,
  total_report_count integer NOT NULL DEFAULT 1,
  last_notified_count integer NOT NULL DEFAULT 1,
  digest_sequence integer NOT NULL DEFAULT 0,
  digest_claimed_by text,
  digest_claimed_at timestamp with time zone,
  last_notified_at timestamp with time zone,
  first_alert_sent_at timestamp with time zone,
  last_update_sent_at timestamp with time zone,
  next_update_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_evt_trackers_sig ON public.test_event_notification_trackers(cluster_signature) WHERE state NOT IN ('CLOSED');
CREATE INDEX IF NOT EXISTS idx_test_evt_trackers_state ON public.test_event_notification_trackers(state);

-- 3. EVENT NOTIFICATION REPORTS (Production & Test)
CREATE TABLE IF NOT EXISTS public.event_notification_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES public.event_notification_trackers(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  public_id text NOT NULL,
  digest_sequence integer,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_evt_reports_report_id UNIQUE (report_id)
);

CREATE TABLE IF NOT EXISTS public.test_event_notification_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES public.test_event_notification_trackers(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.test_reports(id) ON DELETE CASCADE,
  public_id text NOT NULL,
  digest_sequence integer,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_test_evt_reports_report_id UNIQUE (report_id)
);

-- 4. EVENT NOTIFICATION OUTBOX (Production & Test)
CREATE TABLE IF NOT EXISTS public.event_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  tracker_id uuid NOT NULL REFERENCES public.event_notification_trackers(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  digest_sequence integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  destination text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  status text NOT NULL DEFAULT 'queued',
  claim_token text,
  claimed_at timestamp with time zone,
  lease_timeout_at timestamp with time zone,
  error_code text,
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_event_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  tracker_id uuid NOT NULL REFERENCES public.test_event_notification_trackers(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  digest_sequence integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  destination text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  status text NOT NULL DEFAULT 'queued',
  claim_token text,
  claimed_at timestamp with time zone,
  lease_timeout_at timestamp with time zone,
  error_code text,
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. RLS POLICIES (Service Role and Admin Inspection)
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notification_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_event_notification_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notification_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_event_notification_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_event_notification_outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_logs' AND policyname = 'service_role_manage_notification_logs'
  ) THEN
    CREATE POLICY "service_role_manage_notification_logs" ON public.notification_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_notification_trackers' AND policyname = 'service_role_manage_trackers'
  ) THEN
    CREATE POLICY "service_role_manage_trackers" ON public.event_notification_trackers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_notification_reports' AND policyname = 'service_role_manage_event_reports'
  ) THEN
    CREATE POLICY "service_role_manage_event_reports" ON public.event_notification_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_notification_outbox' AND policyname = 'service_role_manage_outbox'
  ) THEN
    CREATE POLICY "service_role_manage_outbox" ON public.event_notification_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

