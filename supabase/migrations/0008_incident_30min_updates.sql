-- ============================================================================
-- MIGRATION: 0008_incident_30min_updates.sql
-- PURPOSE: Incident-Based LINE Notification with 30-Minute Accumulation & Updates
-- 
-- 1. Schema Extensions:
--    - first_alert_sent_at, last_update_sent_at, next_update_at on trackers
--    - 'periodic_update' notification_type on outbox
-- 2. Atomic RPCs:
--    - test_claim_next_incident_update / claim_next_incident_update
--    - test_claim_tracker_incident_update / claim_tracker_incident_update
--    - test_complete_incident_update / complete_incident_update
-- ============================================================================

-- 1. Schema Extensions for Trackers (Test & Production Parity)
DO $$
BEGIN
  -- Test Table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_event_notification_trackers' AND column_name = 'first_alert_sent_at'
  ) THEN
    ALTER TABLE test_event_notification_trackers ADD COLUMN first_alert_sent_at timestamp with time zone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_event_notification_trackers' AND column_name = 'last_update_sent_at'
  ) THEN
    ALTER TABLE test_event_notification_trackers ADD COLUMN last_update_sent_at timestamp with time zone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_event_notification_trackers' AND column_name = 'next_update_at'
  ) THEN
    ALTER TABLE test_event_notification_trackers ADD COLUMN next_update_at timestamp with time zone;
  END IF;

  -- Production Table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_notification_trackers' AND column_name = 'first_alert_sent_at'
  ) THEN
    ALTER TABLE event_notification_trackers ADD COLUMN first_alert_sent_at timestamp with time zone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_notification_trackers' AND column_name = 'last_update_sent_at'
  ) THEN
    ALTER TABLE event_notification_trackers ADD COLUMN last_update_sent_at timestamp with time zone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_notification_trackers' AND column_name = 'next_update_at'
  ) THEN
    ALTER TABLE event_notification_trackers ADD COLUMN next_update_at timestamp with time zone;
  END IF;
END $$;

-- 2. Outbox Notification Type Constraints (Include 'periodic_update')
ALTER TABLE test_event_notification_outbox 
  DROP CONSTRAINT IF EXISTS test_event_notification_outbox_notification_type_check;

ALTER TABLE test_event_notification_outbox 
  ADD CONSTRAINT test_event_notification_outbox_notification_type_check 
  CHECK (notification_type IN ('first_alert', 'digest', 'emergency_alert', 'escalation_alert', 'periodic_update'));

ALTER TABLE event_notification_outbox 
  DROP CONSTRAINT IF EXISTS event_notification_outbox_notification_type_check;

ALTER TABLE event_notification_outbox 
  ADD CONSTRAINT event_notification_outbox_notification_type_check 
  CHECK (notification_type IN ('first_alert', 'digest', 'emergency_alert', 'escalation_alert', 'periodic_update'));

-- 3. TEST RPC: test_claim_tracker_incident_update
CREATE OR REPLACE FUNCTION test_claim_tracker_incident_update(
  p_tracker_id uuid,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30,
  p_as_of_time timestamp with time zone DEFAULT now()
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker record;
  v_next_seq integer;
  v_new_reports_count integer;
  v_total_count integer;
  v_outbox_id uuid;
  v_idempotency_key text;
  v_effective_time timestamp with time zone := coalesce(p_as_of_time, now());
BEGIN
  -- 1. Lock specific tracker
  SELECT * INTO v_tracker
  FROM test_event_notification_trackers
  WHERE id = p_tracker_id
    AND state IN ('AGGREGATING', 'DIGEST_PENDING', 'FIRST_ALERT_SENT')
    AND (
      coalesce(next_update_at, window_expires_at) <= v_effective_time
      OR digest_claimed_at < v_effective_time - (p_lease_seconds || ' seconds')::interval
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'tracker_not_claimable');
  END IF;

  -- 2. Check for new unnotified reports in this event
  SELECT count(*) INTO v_new_reports_count
  FROM test_event_notification_reports
  WHERE tracker_id = p_tracker_id
    AND digest_sequence IS NULL;

  -- 3. If NO new reports: Do not send LINE (Skip round, advance window by 30 mins)
  IF v_new_reports_count = 0 THEN
    UPDATE test_event_notification_trackers
    SET 
      window_expires_at = v_effective_time + interval '30 minutes',
      next_update_at = v_effective_time + interval '30 minutes',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = v_effective_time
    WHERE id = p_tracker_id;

    RETURN jsonb_build_object(
      'success', true, 
      'action', 'window_extended_no_reports', 
      'tracker_id', p_tracker_id,
      'event_code', v_tracker.event_code,
      'new_reports_count', 0
    );
  END IF;

  -- 4. If new reports exist: Create Periodic Update Outbox Job
  v_next_seq := v_tracker.digest_sequence + 1;
  v_idempotency_key := 'evt_update_' || v_tracker.event_code || '_seq' || v_next_seq;

  -- Snapshot the unnotified reports with this sequence number
  UPDATE test_event_notification_reports
  SET digest_sequence = v_next_seq
  WHERE tracker_id = p_tracker_id
    AND digest_sequence IS NULL;

  SELECT count(*) INTO v_total_count
  FROM test_event_notification_reports
  WHERE tracker_id = p_tracker_id;

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
    'periodic_update',
    v_next_seq,
    jsonb_build_object(
      'event_code', v_tracker.event_code,
      'title', v_tracker.title,
      'location', v_tracker.location,
      'priority', v_tracker.priority,
      'total_report_count', v_total_count,
      'new_report_count', v_new_reports_count,
      'previous_notified_count', v_tracker.last_notified_count,
      'digest_sequence', v_next_seq,
      'as_of_time', v_effective_time
    ),
    v_tracker.destination,
    v_tracker.environment,
    'claiming',
    p_worker_id,
    v_effective_time,
    v_effective_time + (p_lease_seconds || ' seconds')::interval
  ) RETURNING id INTO v_outbox_id;

  -- Update tracker claim state
  UPDATE test_event_notification_trackers
  SET 
    state = 'DIGEST_PENDING',
    digest_sequence = v_next_seq,
    digest_claimed_by = p_worker_id,
    digest_claimed_at = v_effective_time,
    total_report_count = v_total_count,
    updated_at = v_effective_time
  WHERE id = p_tracker_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'update_job_created',
    'outbox_id', v_outbox_id,
    'tracker_id', p_tracker_id,
    'event_code', v_tracker.event_code,
    'title', v_tracker.title,
    'location', v_tracker.location,
    'total_report_count', v_total_count,
    'new_report_count', v_new_reports_count,
    'previous_notified_count', v_tracker.last_notified_count,
    'digest_sequence', v_next_seq,
    'destination', v_tracker.destination,
    'idempotency_key', v_idempotency_key
  );
END;
$$ LANGUAGE plpgsql;

-- 4. TEST RPC: test_claim_next_incident_update (Auto-picks next due tracker using SKIP LOCKED)
CREATE OR REPLACE FUNCTION test_claim_next_incident_update(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30,
  p_as_of_time timestamp with time zone DEFAULT now()
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_id uuid;
  v_effective_time timestamp with time zone := coalesce(p_as_of_time, now());
BEGIN
  -- Find next due emergency tracker using SKIP LOCKED to avoid multi-worker collision
  SELECT id INTO v_target_id
  FROM test_event_notification_trackers
  WHERE state IN ('AGGREGATING', 'DIGEST_PENDING', 'FIRST_ALERT_SENT')
    AND priority = 'emergency'
    AND (
      coalesce(next_update_at, window_expires_at) <= v_effective_time
      OR (digest_claimed_at IS NOT NULL AND digest_claimed_at < v_effective_time - (p_lease_seconds || ' seconds')::interval)
    )
  ORDER BY coalesce(next_update_at, window_expires_at) ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_due_trackers');
  END IF;

  RETURN test_claim_tracker_incident_update(v_target_id, p_worker_id, p_lease_seconds, v_effective_time);
END;
$$ LANGUAGE plpgsql;

-- 5. TEST RPC: test_complete_incident_update
CREATE OR REPLACE FUNCTION test_complete_incident_update(
  p_outbox_id uuid,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_as_of_time timestamp with time zone DEFAULT now()
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_outbox record;
  v_effective_time timestamp with time zone := coalesce(p_as_of_time, now());
BEGIN
  SELECT * INTO v_outbox
  FROM test_event_notification_outbox
  WHERE id = p_outbox_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'outbox_not_found');
  END IF;

  IF p_status = 'sent' THEN
    UPDATE test_event_notification_outbox
    SET 
      status = 'sent',
      sent_at = v_effective_time,
      updated_at = v_effective_time
    WHERE id = p_outbox_id;

    UPDATE test_event_notification_trackers
    SET 
      state = 'AGGREGATING',
      last_notified_count = total_report_count,
      last_update_sent_at = v_effective_time,
      last_notified_at = v_effective_time,
      window_expires_at = v_effective_time + interval '30 minutes',
      next_update_at = v_effective_time + interval '30 minutes',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = v_effective_time
    WHERE id = v_outbox.tracker_id;
  ELSIF p_status = 'uncertain_delivery' THEN
    UPDATE test_event_notification_outbox
    SET 
      status = 'uncertain_delivery',
      error_code = 'UNCERTAIN_DELIVERY',
      error_message = coalesce(p_error_message, 'Delivery confirmation uncertain - no blind retry'),
      updated_at = v_effective_time
    WHERE id = p_outbox_id;

    -- Release claim on tracker without blind retry
    UPDATE test_event_notification_trackers
    SET 
      state = 'AGGREGATING',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = v_effective_time
    WHERE id = v_outbox.tracker_id;
  ELSE
    UPDATE test_event_notification_outbox
    SET 
      status = 'failed',
      error_code = coalesce(p_error_code, 'DELIVERY_FAILED'),
      error_message = p_error_message,
      updated_at = v_effective_time
    WHERE id = p_outbox_id;

    UPDATE test_event_notification_trackers
    SET 
      state = 'AGGREGATING',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = v_effective_time
    WHERE id = v_outbox.tracker_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status, 'outbox_id', p_outbox_id);
END;
$$ LANGUAGE plpgsql;

-- 6. PRODUCTION MIRRORS (Full Parity)
CREATE OR REPLACE FUNCTION claim_tracker_incident_update(
  p_tracker_id uuid,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30,
  p_as_of_time timestamp with time zone DEFAULT now()
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker record;
  v_next_seq integer;
  v_new_reports_count integer;
  v_total_count integer;
  v_outbox_id uuid;
  v_idempotency_key text;
  v_effective_time timestamp with time zone := coalesce(p_as_of_time, now());
BEGIN
  SELECT * INTO v_tracker
  FROM event_notification_trackers
  WHERE id = p_tracker_id
    AND state IN ('AGGREGATING', 'DIGEST_PENDING', 'FIRST_ALERT_SENT')
    AND (
      coalesce(next_update_at, window_expires_at) <= v_effective_time
      OR digest_claimed_at < v_effective_time - (p_lease_seconds || ' seconds')::interval
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'tracker_not_claimable');
  END IF;

  SELECT count(*) INTO v_new_reports_count
  FROM event_notification_reports
  WHERE tracker_id = p_tracker_id
    AND digest_sequence IS NULL;

  IF v_new_reports_count = 0 THEN
    UPDATE event_notification_trackers
    SET 
      window_expires_at = v_effective_time + interval '30 minutes',
      next_update_at = v_effective_time + interval '30 minutes',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = v_effective_time
    WHERE id = p_tracker_id;

    RETURN jsonb_build_object(
      'success', true, 
      'action', 'window_extended_no_reports', 
      'tracker_id', p_tracker_id,
      'event_code', v_tracker.event_code,
      'new_reports_count', 0
    );
  END IF;

  v_next_seq := v_tracker.digest_sequence + 1;
  v_idempotency_key := 'evt_update_' || v_tracker.event_code || '_seq' || v_next_seq;

  UPDATE event_notification_reports
  SET digest_sequence = v_next_seq
  WHERE tracker_id = p_tracker_id
    AND digest_sequence IS NULL;

  SELECT count(*) INTO v_total_count
  FROM event_notification_reports
  WHERE tracker_id = p_tracker_id;

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
    'periodic_update',
    v_next_seq,
    jsonb_build_object(
      'event_code', v_tracker.event_code,
      'title', v_tracker.title,
      'location', v_tracker.location,
      'priority', v_tracker.priority,
      'total_report_count', v_total_count,
      'new_report_count', v_new_reports_count,
      'previous_notified_count', v_tracker.last_notified_count,
      'digest_sequence', v_next_seq,
      'as_of_time', v_effective_time
    ),
    v_tracker.destination,
    v_tracker.environment,
    'claiming',
    p_worker_id,
    v_effective_time,
    v_effective_time + (p_lease_seconds || ' seconds')::interval
  ) RETURNING id INTO v_outbox_id;

  UPDATE event_notification_trackers
  SET 
    state = 'DIGEST_PENDING',
    digest_sequence = v_next_seq,
    digest_claimed_by = p_worker_id,
    digest_claimed_at = v_effective_time,
    total_report_count = v_total_count,
    updated_at = v_effective_time
  WHERE id = p_tracker_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'update_job_created',
    'outbox_id', v_outbox_id,
    'tracker_id', p_tracker_id,
    'event_code', v_tracker.event_code,
    'title', v_tracker.title,
    'location', v_tracker.location,
    'total_report_count', v_total_count,
    'new_report_count', v_new_reports_count,
    'previous_notified_count', v_tracker.last_notified_count,
    'digest_sequence', v_next_seq,
    'destination', v_tracker.destination,
    'idempotency_key', v_idempotency_key
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION claim_next_incident_update(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30,
  p_as_of_time timestamp with time zone DEFAULT now()
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_id uuid;
  v_effective_time timestamp with time zone := coalesce(p_as_of_time, now());
BEGIN
  SELECT id INTO v_target_id
  FROM event_notification_trackers
  WHERE state IN ('AGGREGATING', 'DIGEST_PENDING', 'FIRST_ALERT_SENT')
    AND priority = 'emergency'
    AND (
      coalesce(next_update_at, window_expires_at) <= v_effective_time
      OR (digest_claimed_at IS NOT NULL AND digest_claimed_at < v_effective_time - (p_lease_seconds || ' seconds')::interval)
    )
  ORDER BY coalesce(next_update_at, window_expires_at) ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_due_trackers');
  END IF;

  RETURN claim_tracker_incident_update(v_target_id, p_worker_id, p_lease_seconds, v_effective_time);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION complete_incident_update(
  p_outbox_id uuid,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_as_of_time timestamp with time zone DEFAULT now()
) RETURNS jsonb 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_outbox record;
  v_effective_time timestamp with time zone := coalesce(p_as_of_time, now());
BEGIN
  SELECT * INTO v_outbox
  FROM event_notification_outbox
  WHERE id = p_outbox_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'outbox_not_found');
  END IF;

  IF p_status = 'sent' THEN
    UPDATE event_notification_outbox
    SET 
      status = 'sent',
      sent_at = v_effective_time,
      updated_at = v_effective_time
    WHERE id = p_outbox_id;

    UPDATE event_notification_trackers
    SET 
      state = 'AGGREGATING',
      last_notified_count = total_report_count,
      last_update_sent_at = v_effective_time,
      last_notified_at = v_effective_time,
      window_expires_at = v_effective_time + interval '30 minutes',
      next_update_at = v_effective_time + interval '30 minutes',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = v_effective_time
    WHERE id = v_outbox.tracker_id;
  ELSIF p_status = 'uncertain_delivery' THEN
    UPDATE event_notification_outbox
    SET 
      status = 'uncertain_delivery',
      error_code = 'UNCERTAIN_DELIVERY',
      error_message = coalesce(p_error_message, 'Delivery confirmation uncertain - no blind retry'),
      updated_at = v_effective_time
    WHERE id = p_outbox_id;

    UPDATE event_notification_trackers
    SET 
      state = 'AGGREGATING',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = v_effective_time
    WHERE id = v_outbox.tracker_id;
  ELSE
    UPDATE event_notification_outbox
    SET 
      status = 'failed',
      error_code = coalesce(p_error_code, 'DELIVERY_FAILED'),
      error_message = p_error_message,
      updated_at = v_effective_time
    WHERE id = p_outbox_id;

    UPDATE event_notification_trackers
    SET 
      state = 'AGGREGATING',
      digest_claimed_by = NULL,
      digest_claimed_at = NULL,
      updated_at = v_effective_time
    WHERE id = v_outbox.tracker_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status, 'outbox_id', p_outbox_id);
END;
$$ LANGUAGE plpgsql;

-- Permissions
GRANT EXECUTE ON FUNCTION test_claim_tracker_incident_update(uuid, text, integer, timestamp with time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION test_claim_next_incident_update(text, integer, timestamp with time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION test_complete_incident_update(uuid, text, text, text, timestamp with time zone) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION claim_tracker_incident_update(uuid, text, integer, timestamp with time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_next_incident_update(text, integer, timestamp with time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION complete_incident_update(uuid, text, text, text, timestamp with time zone) TO authenticated, service_role;

