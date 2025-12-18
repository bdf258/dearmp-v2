-- Audit Log Alerting Migration
-- Implements security monitoring with automated alerts for sensitive operations
-- Based on SECURITY_ENHANCEMENTS_ARCHITECTURE.md

-- =====================================================
-- 1. EXTEND AUDIT_ACTION ENUM FOR NEW ACTION TYPES
-- =====================================================

-- Add new audit action types for security monitoring
DO $$
BEGIN
  -- Login/Session events
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'login_success' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'login_success';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'login_failure' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'login_failure';
  END IF;

  -- Role/User management events
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'role_change' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'role_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_create' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'user_create';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_delete' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'user_delete';
  END IF;

  -- Settings/Integration events
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'settings_change' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'settings_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'outlook_connect' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'outlook_connect';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'outlook_disconnect' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'outlook_disconnect';
  END IF;

  -- Security events
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bulk_export' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'bulk_export';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'session_anomaly' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'session_anomaly';
  END IF;

  -- Workflow events
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'case_assign' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'case_assign';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'case_close' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'case_close';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_send' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'email_send';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Ignore if already exists
END $$;

-- =====================================================
-- 2. ADD SEVERITY AND ALERT COLUMNS TO AUDIT_LOGS
-- =====================================================

-- Add severity column for categorizing log importance
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'standard'
  CHECK (severity IN ('critical', 'high', 'standard'));

-- Add alert tracking columns
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS alert_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS requires_alert BOOLEAN DEFAULT false;

-- =====================================================
-- 3. CREATE AUDIT ALERT QUEUE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_alert_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID NOT NULL,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'standard')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE audit_alert_queue ENABLE ROW LEVEL SECURITY;

-- Only service role should access alert queue
CREATE POLICY "Service role manages alert queue"
  ON public.audit_alert_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can view alert queue for their office
CREATE POLICY "Admins can view alert queue"
  ON public.audit_alert_queue
  FOR SELECT
  TO authenticated
  USING (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_alert_queue_unprocessed
  ON audit_alert_queue(created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_alert_queue_office
  ON audit_alert_queue(office_id, created_at DESC);

-- =====================================================
-- 4. CREATE FUNCTION TO DETERMINE SEVERITY AND QUEUE ALERTS
-- =====================================================

CREATE OR REPLACE FUNCTION process_audit_alert()
RETURNS TRIGGER AS $$
DECLARE
  alert_severity TEXT;
  should_alert BOOLEAN := false;
BEGIN
  -- Determine severity based on action type
  CASE NEW.action
    -- Critical: Immediate alert required
    WHEN 'role_change' THEN
      alert_severity := 'critical';
      should_alert := true;
    WHEN 'mfa_unenroll' THEN
      alert_severity := 'critical';
      should_alert := true;
    WHEN 'mfa_disable' THEN
      alert_severity := 'critical';
      should_alert := true;
    WHEN 'bulk_export' THEN
      alert_severity := 'critical';
      should_alert := true;
    WHEN 'session_anomaly' THEN
      alert_severity := 'critical';
      should_alert := true;

    -- High: Hourly digest
    WHEN 'user_create' THEN
      alert_severity := 'high';
      should_alert := true;
    WHEN 'user_delete' THEN
      alert_severity := 'high';
      should_alert := true;
    WHEN 'outlook_connect' THEN
      alert_severity := 'high';
      should_alert := true;
    WHEN 'outlook_disconnect' THEN
      alert_severity := 'high';
      should_alert := true;
    WHEN 'settings_change' THEN
      alert_severity := 'high';
      should_alert := true;

    -- Standard: Daily summary (no immediate alert)
    ELSE
      alert_severity := 'standard';
      should_alert := false;
  END CASE;

  -- Update the audit log with severity
  NEW.severity := alert_severity;
  NEW.requires_alert := should_alert;

  -- Queue alert if needed
  IF should_alert THEN
    INSERT INTO audit_alert_queue (audit_log_id, office_id, severity)
    VALUES (NEW.id, NEW.office_id, alert_severity);

    -- For critical alerts, send pg_notify for immediate processing
    IF alert_severity = 'critical' THEN
      PERFORM pg_notify('critical_security_alert', json_build_object(
        'audit_log_id', NEW.id,
        'action', NEW.action,
        'actor_id', NEW.actor_id,
        'office_id', NEW.office_id,
        'metadata', NEW.metadata
      )::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for alert processing (BEFORE INSERT to set severity on NEW)
DROP TRIGGER IF EXISTS audit_alert_trigger ON audit_logs;
CREATE TRIGGER audit_alert_trigger
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION process_audit_alert();

-- =====================================================
-- 5. AUDIT TRIGGER FOR PROFILE ROLE CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION audit_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Detect role changes
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'role_change',
      'profile',
      NEW.id,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'target_user_id', NEW.id,
        'target_user_name', NEW.full_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS profile_role_audit_trigger ON profiles;
CREATE TRIGGER profile_role_audit_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION audit_profile_changes();

-- =====================================================
-- 6. AUDIT TRIGGER FOR USER LIFECYCLE (CREATE/DELETE)
-- =====================================================

CREATE OR REPLACE FUNCTION audit_user_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'user_create',
      'profile',
      NEW.id,
      jsonb_build_object(
        'new_user_name', NEW.full_name,
        'new_user_email', NEW.id::text,
        'role', NEW.role
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      OLD.office_id,
      auth.uid(),
      'user_delete',
      'profile',
      OLD.id,
      jsonb_build_object(
        'deleted_user_name', OLD.full_name,
        'deleted_user_role', OLD.role
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for user lifecycle
DROP TRIGGER IF EXISTS user_create_audit_trigger ON profiles;
CREATE TRIGGER user_create_audit_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_lifecycle();

DROP TRIGGER IF EXISTS user_delete_audit_trigger ON profiles;
CREATE TRIGGER user_delete_audit_trigger
  AFTER DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_lifecycle();

-- =====================================================
-- 7. AUDIT TRIGGER FOR OFFICE SETTINGS CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION audit_office_settings_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields JSONB := '{}'::jsonb;
BEGIN
  -- Build a JSON object of changed fields
  IF OLD.ai_classification_enabled IS DISTINCT FROM NEW.ai_classification_enabled THEN
    changed_fields := changed_fields || jsonb_build_object(
      'ai_classification_enabled', jsonb_build_object('old', OLD.ai_classification_enabled, 'new', NEW.ai_classification_enabled)
    );
  END IF;
  IF OLD.ai_draft_response_enabled IS DISTINCT FROM NEW.ai_draft_response_enabled THEN
    changed_fields := changed_fields || jsonb_build_object(
      'ai_draft_response_enabled', jsonb_build_object('old', OLD.ai_draft_response_enabled, 'new', NEW.ai_draft_response_enabled)
    );
  END IF;
  IF OLD.auto_assign_enabled IS DISTINCT FROM NEW.auto_assign_enabled THEN
    changed_fields := changed_fields || jsonb_build_object(
      'auto_assign_enabled', jsonb_build_object('old', OLD.auto_assign_enabled, 'new', NEW.auto_assign_enabled)
    );
  END IF;
  IF OLD.mp_name IS DISTINCT FROM NEW.mp_name THEN
    changed_fields := changed_fields || jsonb_build_object(
      'mp_name', jsonb_build_object('old', OLD.mp_name, 'new', NEW.mp_name)
    );
  END IF;
  IF OLD.mp_email IS DISTINCT FROM NEW.mp_email THEN
    changed_fields := changed_fields || jsonb_build_object(
      'mp_email', jsonb_build_object('old', OLD.mp_email, 'new', NEW.mp_email)
    );
  END IF;
  IF OLD.inbound_email IS DISTINCT FROM NEW.inbound_email THEN
    changed_fields := changed_fields || jsonb_build_object(
      'inbound_email', jsonb_build_object('old', OLD.inbound_email, 'new', NEW.inbound_email)
    );
  END IF;

  -- Only log if something actually changed
  IF changed_fields != '{}'::jsonb THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'settings_change',
      'office_settings',
      NEW.id,
      jsonb_build_object('changed_fields', changed_fields)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS office_settings_audit_trigger ON office_settings;
CREATE TRIGGER office_settings_audit_trigger
  AFTER UPDATE ON office_settings
  FOR EACH ROW
  EXECUTE FUNCTION audit_office_settings_changes();

-- =====================================================
-- 8. AUDIT TRIGGER FOR OUTLOOK INTEGRATION
-- =====================================================

CREATE OR REPLACE FUNCTION audit_outlook_integration()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'outlook_connect',
      'integration_outlook_sessions',
      NEW.id,
      jsonb_build_object(
        'connected_at', NOW()
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      OLD.office_id,
      auth.uid(),
      'outlook_disconnect',
      'integration_outlook_sessions',
      OLD.id,
      jsonb_build_object(
        'disconnected_at', NOW()
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS outlook_integration_audit_trigger ON integration_outlook_sessions;
CREATE TRIGGER outlook_integration_audit_trigger
  AFTER INSERT OR DELETE ON integration_outlook_sessions
  FOR EACH ROW
  EXECUTE FUNCTION audit_outlook_integration();

-- =====================================================
-- 9. AUDIT TRIGGER FOR CASE ASSIGNMENT
-- =====================================================

CREATE OR REPLACE FUNCTION audit_case_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Detect assignment changes
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'case_assign',
      'case',
      NEW.id,
      jsonb_build_object(
        'case_reference', NEW.reference_number,
        'case_title', NEW.title,
        'old_assignee', OLD.assigned_to,
        'new_assignee', NEW.assigned_to
      )
    );
  END IF;

  -- Detect case closure
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed' THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'case_close',
      'case',
      NEW.id,
      jsonb_build_object(
        'case_reference', NEW.reference_number,
        'case_title', NEW.title,
        'previous_status', OLD.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS case_changes_audit_trigger ON cases;
CREATE TRIGGER case_changes_audit_trigger
  AFTER UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION audit_case_changes();

-- =====================================================
-- 10. CREATE INDEXES FOR EFFICIENT AUDIT QUERIES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
  ON audit_logs(severity);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created
  ON audit_logs(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_requires_alert
  ON audit_logs(requires_alert)
  WHERE requires_alert = true;

-- =====================================================
-- 11. CREATE RPC FUNCTION TO FETCH AUDIT LOGS
-- =====================================================

CREATE OR REPLACE FUNCTION get_audit_logs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_severity TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  office_id UUID,
  actor_id UUID,
  actor_name TEXT,
  action audit_action,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  severity TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.office_id,
    al.actor_id,
    p.full_name as actor_name,
    al.action,
    al.entity_type,
    al.entity_id,
    al.metadata,
    al.severity,
    al.ip_address,
    al.created_at
  FROM audit_logs al
  LEFT JOIN profiles p ON al.actor_id = p.id
  WHERE al.office_id = get_my_office_id()
    AND (p_severity IS NULL OR al.severity = p_severity)
    AND (p_action IS NULL OR al.action::text = p_action)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_audit_logs TO authenticated;

-- =====================================================
-- 12. CREATE RPC FUNCTION TO GET AUDIT STATS
-- =====================================================

CREATE OR REPLACE FUNCTION get_audit_stats(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_events BIGINT,
  critical_events BIGINT,
  high_events BIGINT,
  unique_actors BIGINT,
  most_common_action TEXT,
  most_common_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical,
      COUNT(*) FILTER (WHERE severity = 'high') as high,
      COUNT(DISTINCT actor_id) as actors
    FROM audit_logs
    WHERE office_id = get_my_office_id()
      AND created_at >= NOW() - (p_days || ' days')::interval
  ),
  action_counts AS (
    SELECT action::text as action_name, COUNT(*) as cnt
    FROM audit_logs
    WHERE office_id = get_my_office_id()
      AND created_at >= NOW() - (p_days || ' days')::interval
    GROUP BY action
    ORDER BY cnt DESC
    LIMIT 1
  )
  SELECT
    s.total,
    s.critical,
    s.high,
    s.actors,
    COALESCE(a.action_name, 'none'),
    COALESCE(a.cnt, 0)
  FROM stats s
  LEFT JOIN action_counts a ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_audit_stats TO authenticated;

-- =====================================================
-- 13. LOG THE MIGRATION
-- =====================================================

DO $$
BEGIN
  INSERT INTO public.audit_logs (
    office_id,
    actor_id,
    action,
    entity_type,
    metadata,
    severity,
    created_at
  )
  SELECT
    id,
    NULL,
    'update'::audit_action,
    'security_migration',
    jsonb_build_object(
      'migration', '20241218000001_audit_log_alerting',
      'changes', ARRAY[
        'Added new audit_action enum values for security monitoring',
        'Added severity and alert tracking columns to audit_logs',
        'Created audit_alert_queue table for processing alerts',
        'Created triggers for profile role changes',
        'Created triggers for user lifecycle events',
        'Created triggers for office settings changes',
        'Created triggers for Outlook integration events',
        'Created triggers for case assignment and closure',
        'Created RPC functions for querying audit logs'
      ]
    ),
    'standard',
    NOW()
  FROM public.offices
  LIMIT 1;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
