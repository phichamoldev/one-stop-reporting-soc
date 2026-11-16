-- ============================================================================
-- PROPOSED MIGRATION 0007: EVENT-BASED LINE NOTIFICATION & REPORT-LEVEL MAPPING
-- File: docs/proposed_0007_report_level_mapping.sql
-- Status: PROPOSED FOR REVIEW (DO NOT APPLY AUTOMATICALLY)
--
-- Key Architectural Enhancements:
-- 1. Decouples canonical_group_id from event_notification_trackers
-- 2. Uses incident_group_members as authoritative Single Source of Truth for group linkage
-- 3. Implements Report-Level Mapping (1 Tracker <-> N Groups, 1 Group <-> N Trackers)
-- 4. Atomic claim_and_snapshot_digest with CTE group breakdown aggregation
-- 5. Atomic confirm_incident_draft_atomic & link_reports_to_incident_group_atomic RPCs
-- 6. Durable Idempotency Operations Table with Pre-Execution Advisory Locks (pg_advisory_xact_lock)
-- 7. Hardened FOUND checks, Operation Type validation & Request Hash mismatch detection
-- 8. Trusted Backend Execution Model (service_role only for Production Confirmation RPCs)
-- 9. PostgreSQL cardinality() Array validation (Immune to empty array traps)
-- 10. Strict Parity Mirrors for Test and Production
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TEST TABLES & INDEXES (Parity Sandbox)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS test_event_notification_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL UNIQUE,                             -- e.g. 'EVT-T-20261103-0001'
  cluster_signature text NOT NULL,                             -- Candidate Search Index
  primary_group_hint text,                                     -- Optional display advisory hint
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  location text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency', 'normal', 'needs_review')),
  escalation_version integer NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'NEW' CHECK (
    state IN (
      'NEW',
      'FIRST_ALERT_PENDING',
      'FIRST_ALERT_SENT',
      'AGGREGATING',
      'DIGEST_PENDING',
      'DIGEST_SENT',
      'ESCALATION_ALERT_PENDING',
      'ESCALATION_ALERT_SENT',
      'CLOSED'
    )
  ),
  initial_report_id uuid REFERENCES test_reports(id) ON DELETE SET NULL,
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
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_evt_trackers_sig 
  ON test_event_notification_trackers(cluster_signature) 
  WHERE state NOT IN ('CLOSED');

CREATE INDEX IF NOT EXISTS idx_test_evt_trackers_state ON test_event_notification_trackers(state);
CREATE INDEX IF NOT EXISTS idx_test_evt_trackers_window ON test_event_notification_trackers(window_expires_at);

CREATE TABLE IF NOT EXISTS test_event_notification_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES test_event_notification_trackers(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
  public_id text NOT NULL,
  digest_sequence integer,                                     -- NULL until snapshotted
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_test_evt_reports_report_id UNIQUE (report_id),
  CONSTRAINT uq_test_evt_reports_tracker_report UNIQUE (tracker_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_test_evt_reports_pending 
  ON test_event_notification_reports(tracker_id) 
  WHERE digest_sequence IS NULL;

CREATE TABLE IF NOT EXISTS test_event_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  tracker_id uuid NOT NULL REFERENCES test_event_notification_trackers(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (
    notification_type IN ('first_alert', 'digest', 'emergency_alert', 'escalation_alert')
  ),
  digest_sequence integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  destination text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'claiming', 'sent', 'failed', 'uncertain_delivery', 'skipped')
  ),
  claim_token text,
  claimed_at timestamp with time zone,
  lease_timeout_at timestamp with time zone,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 1,
  error_code text,
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_evt_outbox_status ON test_event_notification_outbox(status);
CREATE INDEX IF NOT EXISTS idx_test_evt_outbox_lease ON test_event_notification_outbox(status, lease_timeout_at);

CREATE TABLE IF NOT EXISTS test_incident_group_operations (
  idempotency_key text PRIMARY KEY,
  operation_type text NOT NULL CHECK (operation_type IN ('confirm_draft', 'link_existing')),
  group_id uuid REFERENCES test_incident_groups(id) ON DELETE SET NULL,
  group_code text NOT NULL,
  request_hash text NOT NULL,
  result_payload jsonb NOT NULL,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_group_ops_created_at ON test_incident_group_operations(created_at);


-- ----------------------------------------------------------------------------
-- 2. PRODUCTION TABLES & INDEXES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_notification_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL UNIQUE,                             -- e.g. 'EVT-20261103-0001'
  cluster_signature text NOT NULL,                             -- Candidate Search Index
  primary_group_hint text,                                     -- Optional display advisory hint
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  location text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency', 'normal', 'needs_review')),
  escalation_version integer NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'NEW' CHECK (
    state IN (
      'NEW',
      'FIRST_ALERT_PENDING',
      'FIRST_ALERT_SENT',
      'AGGREGATING',
      'DIGEST_PENDING',
      'DIGEST_SENT',
      'ESCALATION_ALERT_PENDING',
      'ESCALATION_ALERT_SENT',
      'CLOSED'
    )
  ),
  initial_report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
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
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evt_trackers_sig 
  ON event_notification_trackers(cluster_signature) 
  WHERE state NOT IN ('CLOSED');

CREATE INDEX IF NOT EXISTS idx_evt_trackers_state ON event_notification_trackers(state);
CREATE INDEX IF NOT EXISTS idx_evt_trackers_window ON event_notification_trackers(window_expires_at);

CREATE TABLE IF NOT EXISTS event_notification_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES event_notification_trackers(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  public_id text NOT NULL,
  digest_sequence integer,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_evt_reports_report_id UNIQUE (report_id),
  CONSTRAINT uq_evt_reports_tracker_report UNIQUE (tracker_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_evt_reports_pending 
  ON event_notification_reports(tracker_id) 
  WHERE digest_sequence IS NULL;

CREATE TABLE IF NOT EXISTS event_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  tracker_id uuid NOT NULL REFERENCES event_notification_trackers(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (
    notification_type IN ('first_alert', 'digest', 'emergency_alert', 'escalation_alert')
  ),
  digest_sequence integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  destination text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'production')),
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'claiming', 'sent', 'failed', 'uncertain_delivery', 'skipped')
  ),
  claim_token text,
  claimed_at timestamp with time zone,
  lease_timeout_at timestamp with time zone,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 1,
  error_code text,
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evt_outbox_status ON event_notification_outbox(status);
CREATE INDEX IF NOT EXISTS idx_evt_outbox_lease ON event_notification_outbox(status, lease_timeout_at);

CREATE TABLE IF NOT EXISTS incident_group_operations (
  idempotency_key text PRIMARY KEY,
  operation_type text NOT NULL CHECK (operation_type IN ('confirm_draft', 'link_existing')),
  group_id uuid REFERENCES incident_groups(id) ON DELETE SET NULL,
  group_code text NOT NULL,
  request_hash text NOT NULL,
  result_payload jsonb NOT NULL,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_ops_created_at ON incident_group_operations(created_at);


-- ----------------------------------------------------------------------------
-- 3. ATOMIC FUNCTIONS (Report-Level Mapping & Parity Mirrors)
-- ----------------------------------------------------------------------------

-- 3.1 Production Atomic Digest Claim, Snapshot & Aggregated Group Breakdown
CREATE OR REPLACE FUNCTION claim_and_snapshot_digest(
  p_tracker_id uuid,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker record;
  v_next_seq integer;
  v_snapshotted_count integer;
  v_group_breakdown jsonb;
  v_outbox_id uuid;
  v_idempotency_key text;
BEGIN
  -- 1. Lock and claim tracker row atomically
  SELECT * INTO v_tracker
  FROM event_notification_trackers
  WHERE id = p_tracker_id
    AND state IN ('AGGREGATING', 'DIGEST_PENDING')
    AND window_expires_at <= now()
    AND (digest_claimed_at IS NULL OR digest_claimed_at < now() - interval '60 seconds')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'tracker_not_claimable');
  END IF;

  v_next_seq := v_tracker.digest_sequence + 1;

  -- 2. Atomically snapshot pending reports for this digest sequence via CTE
  WITH snapshotted_reports AS (
    UPDATE event_notification_reports
    SET digest_sequence = v_next_seq
    WHERE tracker_id = p_tracker_id
      AND digest_sequence IS NULL
    RETURNING report_id, public_id
  ),
  aggregated_groups AS (
    SELECT 
      coalesce(ig.group_code, 'UNGROUPED') AS group_code,
      coalesce(ig.title, 'อยู่ระหว่างตรวจสอบ') AS group_title,
      coalesce(ig.status, 'pending') AS group_status,
      count(sr.report_id)::integer AS report_count,
      jsonb_agg(sr.public_id ORDER BY sr.public_id) AS report_public_ids
    FROM snapshotted_reports sr
    LEFT JOIN incident_group_members igm ON igm.report_id = sr.report_id
    LEFT JOIN incident_groups ig ON ig.id = igm.group_id
    GROUP BY coalesce(ig.group_code, 'UNGROUPED'), coalesce(ig.title, 'อยู่ระหว่างตรวจสอบ'), coalesce(ig.status, 'pending')
  )
  SELECT 
    (SELECT count(*) FROM snapshotted_reports) AS total_count,
    coalesce(jsonb_agg(ag.*), '[]'::jsonb) AS breakdown
  INTO v_snapshotted_count, v_group_breakdown
  FROM aggregated_groups ag;

  -- 3. If no new reports, roll window forward without sending empty digest
  IF v_snapshotted_count = 0 THEN
    UPDATE event_notification_trackers
    SET 
      window_expires_at = now() + interval '15 minutes',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = now()
    WHERE id = p_tracker_id;

    RETURN jsonb_build_object('success', true, 'action', 'window_rolled_no_reports');
  END IF;

  -- 4. Create Durable Outbox Job with exact group breakdown
  v_idempotency_key := 'evt_digest_' || v_tracker.event_code || '_seq' || v_next_seq;
  
  INSERT INTO event_notification_outbox (
    idempotency_key,
    tracker_id,
    notification_type,
    digest_sequence,
    payload,
    destination,
    environment,
    status,
    claim_token,
    claimed_at,
    lease_timeout_at
  ) VALUES (
    v_idempotency_key,
    p_tracker_id,
    'digest',
    v_next_seq,
    jsonb_build_object(
      'event_code', v_tracker.event_code,
      'title', v_tracker.title,
      'location', v_tracker.location,
      'snapshotted_report_count', v_snapshotted_count,
      'total_report_count', v_tracker.total_report_count,
      'groups', v_group_breakdown
    ),
    v_tracker.destination,
    v_tracker.environment,
    'claiming',
    p_worker_id,
    now(),
    now() + (p_lease_seconds || ' seconds')::interval
  ) RETURNING id INTO v_outbox_id;

  -- 5. Advance tracker state
  UPDATE event_notification_trackers
  SET 
    state = 'DIGEST_PENDING',
    digest_sequence = v_next_seq,
    digest_claimed_by = p_worker_id,
    digest_claimed_at = now(),
    updated_at = now()
  WHERE id = p_tracker_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'digest_job_created',
    'outbox_id', v_outbox_id,
    'idempotency_key', v_idempotency_key,
    'snapshotted_count', v_snapshotted_count,
    'digest_sequence', v_next_seq,
    'groups', v_group_breakdown
  );
END;
$$ LANGUAGE plpgsql;


-- 3.2 Test Atomic Digest Claim, Snapshot & Aggregated Group Breakdown (Parity Mirror)
CREATE OR REPLACE FUNCTION test_claim_and_snapshot_digest(
  p_tracker_id uuid,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker record;
  v_next_seq integer;
  v_snapshotted_count integer;
  v_group_breakdown jsonb;
  v_outbox_id uuid;
  v_idempotency_key text;
BEGIN
  SELECT * INTO v_tracker
  FROM test_event_notification_trackers
  WHERE id = p_tracker_id
    AND state IN ('AGGREGATING', 'DIGEST_PENDING')
    AND window_expires_at <= now()
    AND (digest_claimed_at IS NULL OR digest_claimed_at < now() - interval '60 seconds')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'tracker_not_claimable');
  END IF;

  v_next_seq := v_tracker.digest_sequence + 1;

  WITH snapshotted_reports AS (
    UPDATE test_event_notification_reports
    SET digest_sequence = v_next_seq
    WHERE tracker_id = p_tracker_id
      AND digest_sequence IS NULL
    RETURNING report_id, public_id
  ),
  aggregated_groups AS (
    SELECT 
      coalesce(ig.group_code, 'UNGROUPED') AS group_code,
      coalesce(ig.title, 'อยู่ระหว่างตรวจสอบ') AS group_title,
      coalesce(ig.status, 'pending') AS group_status,
      count(sr.report_id)::integer AS report_count,
      jsonb_agg(sr.public_id ORDER BY sr.public_id) AS report_public_ids
    FROM snapshotted_reports sr
    LEFT JOIN test_incident_group_members igm ON igm.report_id = sr.report_id
    LEFT JOIN test_incident_groups ig ON ig.id = igm.group_id
    GROUP BY coalesce(ig.group_code, 'UNGROUPED'), coalesce(ig.title, 'อยู่ระหว่างตรวจสอบ'), coalesce(ig.status, 'pending')
  )
  SELECT 
    (SELECT count(*) FROM snapshotted_reports) AS total_count,
    coalesce(jsonb_agg(ag.*), '[]'::jsonb) AS breakdown
  INTO v_snapshotted_count, v_group_breakdown
  FROM aggregated_groups ag;

  IF v_snapshotted_count = 0 THEN
    UPDATE test_event_notification_trackers
    SET 
      window_expires_at = now() + interval '15 minutes',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = now()
    WHERE id = p_tracker_id;

    RETURN jsonb_build_object('success', true, 'action', 'window_rolled_no_reports');
  END IF;

  v_idempotency_key := 'evt_digest_' || v_tracker.event_code || '_seq' || v_next_seq;
  
  INSERT INTO test_event_notification_outbox (
    idempotency_key,
    tracker_id,
    notification_type,
    digest_sequence,
    payload,
    destination,
    environment,
    status,
    claim_token,
    claimed_at,
    lease_timeout_at
  ) VALUES (
    v_idempotency_key,
    p_tracker_id,
    'digest',
    v_next_seq,
    jsonb_build_object(
      'event_code', v_tracker.event_code,
      'title', v_tracker.title,
      'location', v_tracker.location,
      'snapshotted_report_count', v_snapshotted_count,
      'total_report_count', v_tracker.total_report_count,
      'groups', v_group_breakdown
    ),
    v_tracker.destination,
    v_tracker.environment,
    'claiming',
    p_worker_id,
    now(),
    now() + (p_lease_seconds || ' seconds')::interval
  ) RETURNING id INTO v_outbox_id;

  UPDATE test_event_notification_trackers
  SET 
    state = 'DIGEST_PENDING',
    digest_sequence = v_next_seq,
    digest_claimed_by = p_worker_id,
    digest_claimed_at = now(),
    updated_at = now()
  WHERE id = p_tracker_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'digest_job_created',
    'outbox_id', v_outbox_id,
    'idempotency_key', v_idempotency_key,
    'snapshotted_count', v_snapshotted_count,
    'digest_sequence', v_next_seq,
    'groups', v_group_breakdown
  );
END;
$$ LANGUAGE plpgsql;


-- 3.3 Production Atomic Priority Escalation RPC
CREATE OR REPLACE FUNCTION escalate_event_priority(
  p_tracker_id uuid,
  p_report_id uuid,
  p_public_id text,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker record;
  v_new_version integer;
  v_idempotency_key text;
  v_outbox_id uuid;
  v_inserted_tracker_id uuid;
  v_existing_tracker_id uuid;
  v_is_new_report boolean := false;
  v_new_total_count integer;
BEGIN
  -- 1. Parameter Validation
  IF p_tracker_id IS NULL OR p_report_id IS NULL OR p_public_id IS NULL OR trim(p_public_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETERS', 'reason', 'Tracker ID, report ID, and public ID are required');
  END IF;

  -- 2. Lock tracker row
  SELECT * INTO v_tracker
  FROM event_notification_trackers
  WHERE id = p_tracker_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TRACKER_NOT_FOUND', 'reason', 'Event notification tracker not found');
  END IF;

  IF v_tracker.state = 'CLOSED' THEN
    RETURN jsonb_build_object('success', false, 'code', 'TRACKER_CLOSED', 'reason', 'Cannot escalate a closed tracker');
  END IF;

  -- 3. Atomic Report Association via INSERT ... ON CONFLICT ... RETURNING (Eliminates Race Conditions)
  INSERT INTO event_notification_reports (tracker_id, report_id, public_id)
  VALUES (p_tracker_id, p_report_id, trim(p_public_id))
  ON CONFLICT (report_id) DO NOTHING
  RETURNING tracker_id INTO v_inserted_tracker_id;

  IF v_inserted_tracker_id IS NOT NULL THEN
    v_is_new_report := true;
  ELSE
    -- Row already existed; verify that it belongs to this tracker and not another
    SELECT tracker_id INTO v_existing_tracker_id
    FROM event_notification_reports
    WHERE report_id = p_report_id;

    IF v_existing_tracker_id IS NOT NULL AND v_existing_tracker_id != p_tracker_id THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'REPORT_ASSOCIATED_WITH_OTHER_TRACKER', 
        'reason', 'Report is already associated with a different tracker',
        'associated_tracker_id', v_existing_tracker_id
      );
    END IF;

    v_is_new_report := false;
  END IF;

  -- Calculate accurately based on whether a new report association was genuinely created
  v_new_total_count := CASE WHEN v_is_new_report THEN v_tracker.total_report_count + 1 ELSE v_tracker.total_report_count END;

  -- 4. Guard against duplicate escalation if already emergency
  IF v_tracker.priority = 'emergency' THEN
    IF v_is_new_report THEN
      UPDATE event_notification_trackers
      SET 
        total_report_count = v_new_total_count,
        updated_at = now()
      WHERE id = p_tracker_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'escalated', false,
      'reason', 'already_emergency',
      'tracker_id', p_tracker_id,
      'escalation_version', v_tracker.escalation_version,
      'total_report_count', v_new_total_count
    );
  END IF;

  -- 5. Transition Normal/Needs_Review -> Emergency (Increment version atomically)
  v_new_version := v_tracker.escalation_version + 1;
  v_idempotency_key := 'evt_esc_' || v_tracker.event_code || '_v' || v_new_version;

  -- 6. Insert Escalation Outbox Job
  INSERT INTO event_notification_outbox (
    idempotency_key,
    tracker_id,
    notification_type,
    digest_sequence,
    payload,
    destination,
    environment,
    status,
    claim_token,
    claimed_at,
    lease_timeout_at
  ) VALUES (
    v_idempotency_key,
    p_tracker_id,
    'escalation_alert',
    0,
    jsonb_build_object(
      'event_code', v_tracker.event_code,
      'title', v_tracker.title,
      'location', v_tracker.location,
      'escalation_report_public_id', trim(p_public_id),
      'escalation_version', v_new_version,
      'total_report_count', v_new_total_count
    ),
    v_tracker.destination,
    v_tracker.environment,
    'claiming',
    p_worker_id,
    now(),
    now() + (p_lease_seconds || ' seconds')::interval
  ) RETURNING id INTO v_outbox_id;

  -- 7. Advance tracker to ESCALATION_ALERT_PENDING with priority='emergency'
  UPDATE event_notification_trackers
  SET 
    priority = 'emergency',
    escalation_version = v_new_version,
    state = 'ESCALATION_ALERT_PENDING',
    total_report_count = v_new_total_count,
    updated_at = now()
  WHERE id = p_tracker_id;

  RETURN jsonb_build_object(
    'success', true,
    'escalated', true,
    'outbox_id', v_outbox_id,
    'idempotency_key', v_idempotency_key,
    'escalation_version', v_new_version,
    'total_report_count', v_new_total_count
  );
END;
$$ LANGUAGE plpgsql;


-- 3.4 Test Atomic Priority Escalation RPC (Parity Mirror)
CREATE OR REPLACE FUNCTION test_escalate_event_priority(
  p_tracker_id uuid,
  p_report_id uuid,
  p_public_id text,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker record;
  v_new_version integer;
  v_idempotency_key text;
  v_outbox_id uuid;
  v_inserted_tracker_id uuid;
  v_existing_tracker_id uuid;
  v_is_new_report boolean := false;
  v_new_total_count integer;
BEGIN
  -- 1. Parameter Validation
  IF p_tracker_id IS NULL OR p_report_id IS NULL OR p_public_id IS NULL OR trim(p_public_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETERS', 'reason', 'Tracker ID, report ID, and public ID are required');
  END IF;

  -- 2. Lock tracker row
  SELECT * INTO v_tracker
  FROM test_event_notification_trackers
  WHERE id = p_tracker_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TRACKER_NOT_FOUND', 'reason', 'Event notification tracker not found');
  END IF;

  IF v_tracker.state = 'CLOSED' THEN
    RETURN jsonb_build_object('success', false, 'code', 'TRACKER_CLOSED', 'reason', 'Cannot escalate a closed tracker');
  END IF;

  -- 3. Atomic Report Association via INSERT ... ON CONFLICT ... RETURNING (Eliminates Race Conditions)
  INSERT INTO test_event_notification_reports (tracker_id, report_id, public_id)
  VALUES (p_tracker_id, p_report_id, trim(p_public_id))
  ON CONFLICT (report_id) DO NOTHING
  RETURNING tracker_id INTO v_inserted_tracker_id;

  IF v_inserted_tracker_id IS NOT NULL THEN
    v_is_new_report := true;
  ELSE
    -- Row already existed; verify that it belongs to this tracker and not another
    SELECT tracker_id INTO v_existing_tracker_id
    FROM test_event_notification_reports
    WHERE report_id = p_report_id;

    IF v_existing_tracker_id IS NOT NULL AND v_existing_tracker_id != p_tracker_id THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'REPORT_ASSOCIATED_WITH_OTHER_TRACKER', 
        'reason', 'Report is already associated with a different tracker',
        'associated_tracker_id', v_existing_tracker_id
      );
    END IF;

    v_is_new_report := false;
  END IF;

  -- Calculate accurately based on whether a new report association was genuinely created
  v_new_total_count := CASE WHEN v_is_new_report THEN v_tracker.total_report_count + 1 ELSE v_tracker.total_report_count END;

  -- 4. Guard against duplicate escalation if already emergency
  IF v_tracker.priority = 'emergency' THEN
    IF v_is_new_report THEN
      UPDATE test_event_notification_trackers
      SET 
        total_report_count = v_new_total_count,
        updated_at = now()
      WHERE id = p_tracker_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'escalated', false,
      'reason', 'already_emergency',
      'tracker_id', p_tracker_id,
      'escalation_version', v_tracker.escalation_version,
      'total_report_count', v_new_total_count
    );
  END IF;

  -- 5. Transition Normal/Needs_Review -> Emergency (Increment version atomically)
  v_new_version := v_tracker.escalation_version + 1;
  v_idempotency_key := 'evt_esc_' || v_tracker.event_code || '_v' || v_new_version;

  -- 6. Insert Escalation Outbox Job
  INSERT INTO test_event_notification_outbox (
    idempotency_key,
    tracker_id,
    notification_type,
    digest_sequence,
    payload,
    destination,
    environment,
    status,
    claim_token,
    claimed_at,
    lease_timeout_at
  ) VALUES (
    v_idempotency_key,
    p_tracker_id,
    'escalation_alert',
    0,
    jsonb_build_object(
      'event_code', v_tracker.event_code,
      'title', v_tracker.title,
      'location', v_tracker.location,
      'escalation_report_public_id', trim(p_public_id),
      'escalation_version', v_new_version,
      'total_report_count', v_new_total_count
    ),
    v_tracker.destination,
    v_tracker.environment,
    'claiming',
    p_worker_id,
    now(),
    now() + (p_lease_seconds || ' seconds')::interval
  ) RETURNING id INTO v_outbox_id;

  -- 7. Advance tracker to ESCALATION_ALERT_PENDING with priority='emergency'
  UPDATE test_event_notification_trackers
  SET 
    priority = 'emergency',
    escalation_version = v_new_version,
    state = 'ESCALATION_ALERT_PENDING',
    total_report_count = v_new_total_count,
    updated_at = now()
  WHERE id = p_tracker_id;

  RETURN jsonb_build_object(
    'success', true,
    'escalated', true,
    'outbox_id', v_outbox_id,
    'idempotency_key', v_idempotency_key,
    'escalation_version', v_new_version,
    'total_report_count', v_new_total_count
  );
END;
$$ LANGUAGE plpgsql;


-- 3.5 Production Atomic Draft Confirmation RPC with Pre-Execution Advisory Locking & FOUND Checks
CREATE OR REPLACE FUNCTION confirm_incident_draft_atomic(
  p_title text,
  p_description text,
  p_category_id integer,
  p_report_ids uuid[],
  p_draft_fingerprint text,
  p_staff_id uuid,
  p_idempotency_key text,
  p_request_hash text
) RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_idempotency_key text;
  v_request_hash text;
  v_staff record;
  v_group_id uuid;
  v_group_code text;
  v_rep_id uuid;
  v_already_grouped uuid;
  v_found_count integer;
  v_cached_op record;
  v_result jsonb;
BEGIN
  -- 1. Strict Parameter Validation & Normalization for Idempotency
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'INVALID_IDEMPOTENCY_KEY', 
      'reason', 'Idempotency key is required and cannot be empty'
    );
  END IF;

  IF p_request_hash IS NULL OR trim(p_request_hash) = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'INVALID_REQUEST_HASH', 
      'reason', 'Request hash is required and cannot be empty'
    );
  END IF;

  v_idempotency_key := trim(p_idempotency_key);
  v_request_hash := trim(p_request_hash);

  -- 2. Pre-Execution Transaction Advisory Lock on Normalized Idempotency Key
  PERFORM pg_advisory_xact_lock(hashtext('ops_idemp_' || v_idempotency_key));

  -- Check if operation was already completed
  SELECT operation_type, group_id, group_code, request_hash, result_payload
  INTO v_cached_op
  FROM incident_group_operations
  WHERE idempotency_key = v_idempotency_key;

  IF FOUND THEN
    -- Validate operation type
    IF v_cached_op.operation_type != 'confirm_draft' THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_OPERATION', 
        'reason', 'This idempotency key was already used for a different operation type'
      );
    END IF;

    -- Validate request payload hash using NULL-safe comparison
    IF v_cached_op.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 
        'reason', 'This idempotency key was already used for a different request payload'
      );
    END IF;

    -- Idempotent Replay
    RETURN v_cached_op.result_payload;
  END IF;

  -- 3. Staff Identity & Authorization Guard (Called via Service Role proxy from Next.js Trusted Backend)
  SELECT id, full_name, role, department_id INTO v_staff
  FROM staff_users
  WHERE id = p_staff_id AND status = 'active';

  IF v_staff.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED_STAFF', 'reason', 'Active staff profile not found');
  END IF;

  IF v_staff.role NOT IN ('super_admin', 'admin', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN_ROLE', 'reason', 'Staff role has insufficient permissions');
  END IF;

  -- 4. Array Validation using cardinality() (Immune to PostgreSQL array traps)
  IF coalesce(cardinality(p_report_ids), 0) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_REPORTS', 'reason', 'Report IDs array cannot be empty or null');
  END IF;

  IF (SELECT count(DISTINCT r) FROM unnest(p_report_ids) r) != cardinality(p_report_ids) THEN
    RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_REPORT_IDS', 'reason', 'Report IDs array contains duplicate elements');
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_TITLE', 'reason', 'Group title is required');
  END IF;

  IF p_draft_fingerprint IS NULL OR trim(p_draft_fingerprint) = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'MISSING_FINGERPRINT', 'reason', 'Draft fingerprint is required for validation');
  END IF;

  -- 5. Deterministic Row Locking (Order by ID to prevent Deadlocks)
  PERFORM id FROM reports 
  WHERE id = ANY(p_report_ids) 
  ORDER BY id 
  FOR UPDATE;

  SELECT count(*) INTO v_found_count FROM reports WHERE id = ANY(p_report_ids);
  IF v_found_count != cardinality(p_report_ids) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REPORT_NOT_FOUND', 'reason', 'One or more report IDs do not exist');
  END IF;

  -- 6. Stale Draft Guard: Verify no report is already confirmed in any group
  SELECT report_id INTO v_already_grouped
  FROM incident_group_members
  WHERE report_id = ANY(p_report_ids)
  LIMIT 1;

  IF v_already_grouped IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'REPORT_ALREADY_GROUPED', 
      'reason', 'One or more reports are already confirmed in another incident group',
      'conflicting_report_id', v_already_grouped
    );
  END IF;

  -- 7. Atomic Group Code Generation via Sequence
  v_group_code := 'INC-' || lpad(nextval('incident_groups_seq')::text, 5, '0');

  -- 8. Atomic Insert into incident_groups
  INSERT INTO incident_groups (
    group_code, title, description, category_id, status, created_by
  ) VALUES (
    v_group_code, trim(p_title), p_description, p_category_id, 'open', v_staff.id
  ) RETURNING id INTO v_group_id;

  -- 9. Bulk Insert Members & Logs
  FOREACH v_rep_id IN ARRAY p_report_ids LOOP
    INSERT INTO incident_group_members (group_id, report_id, added_by, notes)
    VALUES (v_group_id, v_rep_id, v_staff.id, 'ยืนยันจากร่างข้อเสนอรวมกลุ่มอัตโนมัติ (' || p_draft_fingerprint || ')');

    INSERT INTO report_logs (report_id, user_id, action, remark)
    VALUES (v_rep_id, v_staff.id, 'incident_group_added', 'ยืนยันคำร้องเข้ากลุ่มเหตุการณ์ ' || v_group_code || ' จากร่างข้อเสนอ');
  END LOOP;

  -- 10. Record History
  INSERT INTO incident_group_history (group_id, action, actor_id, actor_name, details)
  VALUES (
    v_group_id, 
    'create_group', 
    v_staff.id, 
    v_staff.full_name, 
    jsonb_build_object(
      'group_code', v_group_code,
      'title', trim(p_title),
      'source', 'confirmed_from_draft',
      'draft_fingerprint', p_draft_fingerprint,
      'initial_reports_count', cardinality(p_report_ids)
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'group_id', v_group_id,
    'group_code', v_group_code,
    'member_count', cardinality(p_report_ids),
    'draft_fingerprint', p_draft_fingerprint
  );

  -- 11. Persist Idempotency Operation Record Atomically
  INSERT INTO incident_group_operations (
    idempotency_key, operation_type, group_id, group_code, request_hash, result_payload, created_by
  ) VALUES (
    v_idempotency_key, 'confirm_draft', v_group_id, v_group_code, v_request_hash, v_result, v_staff.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- 3.6 Test Atomic Draft Confirmation RPC with Pre-Execution Advisory Locking (Parity Mirror)
CREATE OR REPLACE FUNCTION test_confirm_incident_draft_atomic(
  p_title text,
  p_description text,
  p_category_id integer,
  p_report_ids uuid[],
  p_draft_fingerprint text,
  p_staff_id uuid,
  p_idempotency_key text,
  p_request_hash text
) RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_idempotency_key text;
  v_request_hash text;
  v_staff record;
  v_group_id uuid;
  v_group_code text;
  v_rep_id uuid;
  v_already_grouped uuid;
  v_found_count integer;
  v_cached_op record;
  v_result jsonb;
BEGIN
  -- 1. Strict Parameter Validation & Normalization for Idempotency
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'INVALID_IDEMPOTENCY_KEY', 
      'reason', 'Idempotency key is required and cannot be empty'
    );
  END IF;

  IF p_request_hash IS NULL OR trim(p_request_hash) = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'INVALID_REQUEST_HASH', 
      'reason', 'Request hash is required and cannot be empty'
    );
  END IF;

  v_idempotency_key := trim(p_idempotency_key);
  v_request_hash := trim(p_request_hash);

  -- 2. Pre-Execution Transaction Advisory Lock on Normalized Idempotency Key
  PERFORM pg_advisory_xact_lock(hashtext('ops_idemp_' || v_idempotency_key));

  SELECT operation_type, group_id, group_code, request_hash, result_payload
  INTO v_cached_op
  FROM test_incident_group_operations
  WHERE idempotency_key = v_idempotency_key;

  IF FOUND THEN
    IF v_cached_op.operation_type != 'confirm_draft' THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_OPERATION', 
        'reason', 'This idempotency key was already used for a different operation type'
      );
    END IF;

    IF v_cached_op.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 
        'reason', 'This idempotency key was already used for a different request payload'
      );
    END IF;

    RETURN v_cached_op.result_payload;
  END IF;

  -- 3. Staff Identity & Authorization Guard
  SELECT id, full_name, role, department_id INTO v_staff
  FROM staff_users
  WHERE id = p_staff_id AND status = 'active';

  IF v_staff.id IS NULL OR v_staff.role NOT IN ('super_admin', 'admin', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN_ROLE', 'reason', 'Staff role has insufficient permissions');
  END IF;

  -- 4. Array Validation using cardinality() (Immune to PostgreSQL array traps)
  IF coalesce(cardinality(p_report_ids), 0) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_REPORTS', 'reason', 'Report IDs array cannot be empty or null');
  END IF;

  IF (SELECT count(DISTINCT r) FROM unnest(p_report_ids) r) != cardinality(p_report_ids) THEN
    RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_REPORT_IDS', 'reason', 'Report IDs array contains duplicate elements');
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_TITLE', 'reason', 'Group title is required');
  END IF;

  IF p_draft_fingerprint IS NULL OR trim(p_draft_fingerprint) = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'MISSING_FINGERPRINT', 'reason', 'Draft fingerprint is required for validation');
  END IF;

  -- 5. Deterministic Row Locking (Order by ID to prevent Deadlocks)
  PERFORM id FROM test_reports 
  WHERE id = ANY(p_report_ids) 
  ORDER BY id 
  FOR UPDATE;

  SELECT count(*) INTO v_found_count FROM test_reports WHERE id = ANY(p_report_ids);
  IF v_found_count != cardinality(p_report_ids) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REPORT_NOT_FOUND', 'reason', 'One or more report IDs do not exist');
  END IF;

  -- 6. Stale Draft Guard: Verify no report is already confirmed in any group
  SELECT report_id INTO v_already_grouped
  FROM test_incident_group_members
  WHERE report_id = ANY(p_report_ids)
  LIMIT 1;

  IF v_already_grouped IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'REPORT_ALREADY_GROUPED', 
      'reason', 'One or more reports are already confirmed in another incident group',
      'conflicting_report_id', v_already_grouped
    );
  END IF;

  -- 7. Atomic Group Code Generation via Test Sequence
  v_group_code := 'INC-T-' || lpad(nextval('test_incident_groups_seq')::text, 5, '0');

  -- 8. Atomic Insert into test_incident_groups
  INSERT INTO test_incident_groups (
    group_code, title, description, category_id, status, created_by
  ) VALUES (
    v_group_code, trim(p_title), p_description, p_category_id, 'open', v_staff.id
  ) RETURNING id INTO v_group_id;

  -- 9. Bulk Insert Members & Logs
  FOREACH v_rep_id IN ARRAY p_report_ids LOOP
    INSERT INTO test_incident_group_members (group_id, report_id, added_by, notes)
    VALUES (v_group_id, v_rep_id, v_staff.id, 'ยืนยันจากร่างข้อเสนอรวมกลุ่มอัตโนมัติ (' || p_draft_fingerprint || ')');

    INSERT INTO test_report_logs (report_id, user_id, action, remark)
    VALUES (v_rep_id, v_staff.id, 'incident_group_added', 'ยืนยันคำร้องเข้ากลุ่มเหตุการณ์ ' || v_group_code || ' จากร่างข้อเสนอ');
  END LOOP;

  -- 10. Record History
  INSERT INTO test_incident_group_history (group_id, action, actor_id, actor_name, details)
  VALUES (
    v_group_id, 
    'create_group', 
    v_staff.id, 
    v_staff.full_name, 
    jsonb_build_object(
      'group_code', v_group_code,
      'title', trim(p_title),
      'source', 'confirmed_from_draft',
      'draft_fingerprint', p_draft_fingerprint,
      'initial_reports_count', cardinality(p_report_ids)
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'group_id', v_group_id,
    'group_code', v_group_code,
    'member_count', cardinality(p_report_ids),
    'draft_fingerprint', p_draft_fingerprint
  );

  -- 11. Persist Idempotency Operation Record Atomically
  INSERT INTO test_incident_group_operations (
    idempotency_key, operation_type, group_id, group_code, request_hash, result_payload, created_by
  ) VALUES (
    v_idempotency_key, 'confirm_draft', v_group_id, v_group_code, v_request_hash, v_result, v_staff.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- 3.7 Production Atomic Link Reports to Existing Group RPC with Pre-Execution Advisory Locking
CREATE OR REPLACE FUNCTION link_reports_to_incident_group_atomic(
  p_group_id uuid,
  p_report_ids uuid[],
  p_staff_id uuid,
  p_idempotency_key text,
  p_request_hash text
) RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_idempotency_key text;
  v_request_hash text;
  v_staff record;
  v_group record;
  v_rep_id uuid;
  v_already_grouped uuid;
  v_found_count integer;
  v_cached_op record;
  v_result jsonb;
BEGIN
  -- 1. Strict Parameter Validation & Normalization for Idempotency
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'INVALID_IDEMPOTENCY_KEY', 
      'reason', 'Idempotency key is required and cannot be empty'
    );
  END IF;

  IF p_request_hash IS NULL OR trim(p_request_hash) = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'INVALID_REQUEST_HASH', 
      'reason', 'Request hash is required and cannot be empty'
    );
  END IF;

  v_idempotency_key := trim(p_idempotency_key);
  v_request_hash := trim(p_request_hash);

  -- 2. Pre-Execution Transaction Advisory Lock on Normalized Idempotency Key
  PERFORM pg_advisory_xact_lock(hashtext('ops_idemp_' || v_idempotency_key));

  SELECT operation_type, group_id, group_code, request_hash, result_payload
  INTO v_cached_op
  FROM incident_group_operations
  WHERE idempotency_key = v_idempotency_key;

  IF FOUND THEN
    IF v_cached_op.operation_type != 'link_existing' THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_OPERATION', 
        'reason', 'This idempotency key was already used for a different operation type'
      );
    END IF;

    IF v_cached_op.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 
        'reason', 'This idempotency key was already used for a different request payload'
      );
    END IF;

    RETURN v_cached_op.result_payload;
  END IF;

  -- 3. Staff Identity & Authorization Guard
  SELECT id, full_name, role INTO v_staff FROM staff_users WHERE id = p_staff_id AND status = 'active';

  IF v_staff.id IS NULL OR v_staff.role NOT IN ('super_admin', 'admin', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'reason', 'Unauthorized staff role');
  END IF;

  -- 4. Array Validation
  IF coalesce(cardinality(p_report_ids), 0) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_REPORTS', 'reason', 'Report IDs array cannot be empty or null');
  END IF;

  -- 5. Lock target group row
  SELECT id, group_code, status INTO v_group
  FROM incident_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'GROUP_NOT_FOUND', 'reason', 'Target incident group not found');
  END IF;

  IF v_group.status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'code', 'GROUP_CLOSED', 'reason', 'Cannot link reports to a closed incident group');
  END IF;

  -- 6. Deterministic Row Locking (Order by ID to prevent Deadlocks)
  PERFORM id FROM reports WHERE id = ANY(p_report_ids) ORDER BY id FOR UPDATE;
  
  SELECT count(*) INTO v_found_count FROM reports WHERE id = ANY(p_report_ids);
  IF v_found_count != cardinality(p_report_ids) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REPORT_NOT_FOUND', 'reason', 'One or more report IDs do not exist');
  END IF;

  -- 7. Stale Draft Guard
  SELECT report_id INTO v_already_grouped
  FROM incident_group_members
  WHERE report_id = ANY(p_report_ids)
  LIMIT 1;

  IF v_already_grouped IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'REPORT_ALREADY_GROUPED', 'reason', 'Report is already in an incident group', 'report_id', v_already_grouped);
  END IF;

  -- 8. Bulk Insert Members & Logs
  FOREACH v_rep_id IN ARRAY p_report_ids LOOP
    INSERT INTO incident_group_members (group_id, report_id, added_by, notes)
    VALUES (p_group_id, v_rep_id, v_staff.id, 'รวมเข้ากลุ่มเหตุการณ์เดิม');

    INSERT INTO report_logs (report_id, user_id, action, remark)
    VALUES (v_rep_id, v_staff.id, 'incident_group_added', 'เชื่อมโยงคำร้องเข้ากลุ่มเหตุการณ์ ' || v_group.group_code);
  END LOOP;

  -- 9. Record History
  INSERT INTO incident_group_history (group_id, action, actor_id, actor_name, details)
  VALUES (p_group_id, 'add_reports', v_staff.id, v_staff.full_name, jsonb_build_object('added_count', cardinality(p_report_ids)));

  v_result := jsonb_build_object('success', true, 'group_code', v_group.group_code, 'added_count', cardinality(p_report_ids));

  -- 10. Persist Idempotency Operation Record Atomically
  INSERT INTO incident_group_operations (
    idempotency_key, operation_type, group_id, group_code, request_hash, result_payload, created_by
  ) VALUES (
    v_idempotency_key, 'link_existing', p_group_id, v_group.group_code, v_request_hash, v_result, v_staff.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- 3.8 Test Atomic Link Reports to Existing Group RPC (Parity Mirror)
CREATE OR REPLACE FUNCTION test_link_reports_to_incident_group_atomic(
  p_group_id uuid,
  p_report_ids uuid[],
  p_staff_id uuid,
  p_idempotency_key text,
  p_request_hash text
) RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_idempotency_key text;
  v_request_hash text;
  v_staff record;
  v_group record;
  v_rep_id uuid;
  v_already_grouped uuid;
  v_found_count integer;
  v_cached_op record;
  v_result jsonb;
BEGIN
  -- 1. Strict Parameter Validation & Normalization for Idempotency
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'INVALID_IDEMPOTENCY_KEY', 
      'reason', 'Idempotency key is required and cannot be empty'
    );
  END IF;

  IF p_request_hash IS NULL OR trim(p_request_hash) = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'INVALID_REQUEST_HASH', 
      'reason', 'Request hash is required and cannot be empty'
    );
  END IF;

  v_idempotency_key := trim(p_idempotency_key);
  v_request_hash := trim(p_request_hash);

  -- 2. Pre-Execution Transaction Advisory Lock on Normalized Idempotency Key
  PERFORM pg_advisory_xact_lock(hashtext('ops_idemp_' || v_idempotency_key));

  SELECT operation_type, group_id, group_code, request_hash, result_payload
  INTO v_cached_op
  FROM test_incident_group_operations
  WHERE idempotency_key = v_idempotency_key;

  IF FOUND THEN
    IF v_cached_op.operation_type != 'link_existing' THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_OPERATION', 
        'reason', 'This idempotency key was already used for a different operation type'
      );
    END IF;

    IF v_cached_op.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN jsonb_build_object(
        'success', false, 
        'code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 
        'reason', 'This idempotency key was already used for a different request payload'
      );
    END IF;

    RETURN v_cached_op.result_payload;
  END IF;

  -- 3. Staff Identity & Authorization Guard
  SELECT id, full_name, role INTO v_staff FROM staff_users WHERE id = p_staff_id AND status = 'active';

  IF v_staff.id IS NULL OR v_staff.role NOT IN ('super_admin', 'admin', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'reason', 'Unauthorized staff role');
  END IF;

  -- 4. Array Validation
  IF coalesce(cardinality(p_report_ids), 0) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_REPORTS', 'reason', 'Report IDs array cannot be empty or null');
  END IF;

  -- 5. Lock target group row
  SELECT id, group_code, status INTO v_group
  FROM test_incident_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'GROUP_NOT_FOUND', 'reason', 'Target incident group not found');
  END IF;

  IF v_group.status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'code', 'GROUP_CLOSED', 'reason', 'Cannot link reports to a closed incident group');
  END IF;

  -- 6. Deterministic Row Locking (Order by ID to prevent Deadlocks)
  PERFORM id FROM test_reports WHERE id = ANY(p_report_ids) ORDER BY id FOR UPDATE;
  
  SELECT count(*) INTO v_found_count FROM test_reports WHERE id = ANY(p_report_ids);
  IF v_found_count != cardinality(p_report_ids) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REPORT_NOT_FOUND', 'reason', 'One or more report IDs do not exist');
  END IF;

  -- 7. Stale Draft Guard
  SELECT report_id INTO v_already_grouped
  FROM test_incident_group_members
  WHERE report_id = ANY(p_report_ids)
  LIMIT 1;

  IF v_already_grouped IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'REPORT_ALREADY_GROUPED', 'reason', 'Report is already in an incident group', 'report_id', v_already_grouped);
  END IF;

  -- 8. Bulk Insert Members & Logs
  FOREACH v_rep_id IN ARRAY p_report_ids LOOP
    INSERT INTO test_incident_group_members (group_id, report_id, added_by, notes)
    VALUES (p_group_id, v_rep_id, v_staff.id, 'รวมเข้ากลุ่มเหตุการณ์เดิม');

    INSERT INTO test_report_logs (report_id, user_id, action, remark)
    VALUES (v_rep_id, v_staff.id, 'incident_group_added', 'เชื่อมโยงคำร้องเข้ากลุ่มเหตุการณ์ ' || v_group.group_code);
  END LOOP;

  -- 9. Record History
  INSERT INTO test_incident_group_history (group_id, action, actor_id, actor_name, details)
  VALUES (p_group_id, 'add_reports', v_staff.id, v_staff.full_name, jsonb_build_object('added_count', cardinality(p_report_ids)));

  v_result := jsonb_build_object('success', true, 'group_code', v_group.group_code, 'added_count', cardinality(p_report_ids));

  -- 10. Persist Idempotency Operation Record Atomically
  INSERT INTO test_incident_group_operations (
    idempotency_key, operation_type, group_id, group_code, request_hash, result_payload, created_by
  ) VALUES (
    v_idempotency_key, 'link_existing', p_group_id, v_group.group_code, v_request_hash, v_result, v_staff.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- ----------------------------------------------------------------------------
-- 4. RLS POLICIES & PERMISSIONS (Strictly Verified Signatures)
-- ----------------------------------------------------------------------------

ALTER TABLE test_event_notification_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_event_notification_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_event_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_incident_group_operations ENABLE ROW LEVEL SECURITY;

ALTER TABLE event_notification_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_notification_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_group_operations ENABLE ROW LEVEL SECURITY;

-- Deny public direct access
DROP POLICY IF EXISTS "deny_public_test_evt_trackers" ON test_event_notification_trackers;
CREATE POLICY "deny_public_test_evt_trackers" ON test_event_notification_trackers FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "deny_public_evt_trackers" ON event_notification_trackers;
CREATE POLICY "deny_public_evt_trackers" ON event_notification_trackers FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "deny_public_test_group_ops" ON test_incident_group_operations;
CREATE POLICY "deny_public_test_group_ops" ON test_incident_group_operations FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "deny_public_group_ops" ON incident_group_operations;
CREATE POLICY "deny_public_group_ops" ON incident_group_operations FOR ALL TO public USING (false);

-- Authenticated staff select (Hardened to active staff users only)
DROP POLICY IF EXISTS "staff_select_test_evt_trackers" ON test_event_notification_trackers;
CREATE POLICY "staff_select_test_evt_trackers" ON test_event_notification_trackers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid() AND su.status = 'active')
);

DROP POLICY IF EXISTS "staff_select_evt_trackers" ON event_notification_trackers;
CREATE POLICY "staff_select_evt_trackers" ON event_notification_trackers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff_users su WHERE su.id = auth.uid() AND su.status = 'active')
);

-- Permissions for Production RPCs: Restricted strictly to service_role (Trusted Backend)
REVOKE EXECUTE ON FUNCTION claim_and_snapshot_digest(uuid, text, integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION claim_and_snapshot_digest(uuid, text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION escalate_event_priority(uuid, uuid, text, text, integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION escalate_event_priority(uuid, uuid, text, text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION confirm_incident_draft_atomic(text, text, integer, uuid[], text, uuid, text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION confirm_incident_draft_atomic(text, text, integer, uuid[], text, uuid, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION link_reports_to_incident_group_atomic(uuid, uuid[], uuid, text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION link_reports_to_incident_group_atomic(uuid, uuid[], uuid, text, text) TO service_role;

-- Permissions for Test Sandbox RPCs: Restricted to service_role only (Principle of Least Privilege)
REVOKE EXECUTE ON FUNCTION test_claim_and_snapshot_digest(uuid, text, integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION test_claim_and_snapshot_digest(uuid, text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION test_escalate_event_priority(uuid, uuid, text, text, integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION test_escalate_event_priority(uuid, uuid, text, text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION test_confirm_incident_draft_atomic(text, text, integer, uuid[], text, uuid, text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION test_confirm_incident_draft_atomic(text, text, integer, uuid[], text, uuid, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION test_link_reports_to_incident_group_atomic(uuid, uuid[], uuid, text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION test_link_reports_to_incident_group_atomic(uuid, uuid[], uuid, text, text) TO service_role;

-- Security Hardening: Revoke schema creation privileges from unprivileged roles
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Security Hardening: Revoke default direct table access from PUBLIC
REVOKE ALL ON TABLE test_event_notification_trackers FROM PUBLIC;
REVOKE ALL ON TABLE test_event_notification_reports FROM PUBLIC;
REVOKE ALL ON TABLE test_event_notification_outbox FROM PUBLIC;
REVOKE ALL ON TABLE test_incident_group_operations FROM PUBLIC;

REVOKE ALL ON TABLE event_notification_trackers FROM PUBLIC;
REVOKE ALL ON TABLE event_notification_reports FROM PUBLIC;
REVOKE ALL ON TABLE event_notification_outbox FROM PUBLIC;
REVOKE ALL ON TABLE incident_group_operations FROM PUBLIC;
