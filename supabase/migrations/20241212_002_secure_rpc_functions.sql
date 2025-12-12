-- Security Fix: Secure RPC Functions with Authorization Checks
-- Date: 2024-12-12
--
-- This migration updates RPC functions to include proper authorization checks
-- before allowing operations.

-- ============================================================================
-- SECURE increment_campaign_count
-- ============================================================================

DROP FUNCTION IF EXISTS increment_campaign_count(UUID);

CREATE OR REPLACE FUNCTION increment_campaign_count(campaign_id UUID)
RETURNS VOID AS $$
DECLARE
  campaign_office_id UUID;
BEGIN
  -- Get the campaign's office_id
  SELECT office_id INTO campaign_office_id
  FROM campaigns
  WHERE id = campaign_id;

  -- SECURITY: Verify the campaign exists and user has access
  IF campaign_office_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- SECURITY: Verify user belongs to the same office (unless service role)
  -- Service role queries bypass RLS, so we check if this is a user request
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF campaign_office_id != public.get_user_office_id() THEN
      RAISE EXCEPTION 'Access denied: Campaign belongs to a different office';
    END IF;
  END IF;

  -- Proceed with the update
  UPDATE campaigns
  SET email_count = COALESCE(email_count, 0) + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURE increment_bulk_response_recipients
-- ============================================================================

DROP FUNCTION IF EXISTS increment_bulk_response_recipients(UUID);

CREATE OR REPLACE FUNCTION increment_bulk_response_recipients(bulk_response_id UUID)
RETURNS VOID AS $$
DECLARE
  br_office_id UUID;
BEGIN
  -- Get the bulk response's office_id
  SELECT office_id INTO br_office_id
  FROM bulk_responses
  WHERE id = bulk_response_id;

  -- SECURITY: Verify the bulk response exists
  IF br_office_id IS NULL THEN
    RAISE EXCEPTION 'Bulk response not found';
  END IF;

  -- SECURITY: Verify user belongs to the same office (unless service role)
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF br_office_id != public.get_user_office_id() THEN
      RAISE EXCEPTION 'Access denied: Bulk response belongs to a different office';
    END IF;
  END IF;

  -- Proceed with the update
  UPDATE bulk_responses
  SET total_recipients = COALESCE(total_recipients, 0) + 1,
      updated_at = NOW()
  WHERE id = bulk_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURE get_pending_messages_for_processing
-- ============================================================================

DROP FUNCTION IF EXISTS get_pending_messages_for_processing(INTEGER);

CREATE OR REPLACE FUNCTION get_pending_messages_for_processing(batch_size INTEGER DEFAULT 10)
RETURNS TABLE (
  queue_id UUID,
  message_id UUID,
  office_id UUID
) AS $$
BEGIN
  -- SECURITY: This function should only be called by service role (edge functions)
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only service role can access processing queue';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    UPDATE ai_processing_queue
    SET status = 'processing',
        started_at = NOW(),
        attempts = attempts + 1
    WHERE id IN (
      SELECT q.id
      FROM ai_processing_queue q
      WHERE q.status = 'pending'
        AND q.attempts < q.max_attempts
      ORDER BY q.priority DESC, q.created_at ASC
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, ai_processing_queue.message_id, ai_processing_queue.office_id
  )
  SELECT claimed.id, claimed.message_id, claimed.office_id FROM claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURE mark_queue_item_failed
-- ============================================================================

DROP FUNCTION IF EXISTS mark_queue_item_failed(UUID, TEXT);

CREATE OR REPLACE FUNCTION mark_queue_item_failed(
  queue_item_id UUID,
  error_message TEXT
)
RETURNS VOID AS $$
DECLARE
  queue_office_id UUID;
BEGIN
  -- Get the queue item's office_id
  SELECT office_id INTO queue_office_id
  FROM ai_processing_queue
  WHERE id = queue_item_id;

  -- SECURITY: Verify the queue item exists
  IF queue_office_id IS NULL THEN
    RAISE EXCEPTION 'Queue item not found';
  END IF;

  -- SECURITY: Only service role can mark items as failed
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only service role can update processing queue';
  END IF;

  -- Proceed with the update
  UPDATE ai_processing_queue
  SET status = CASE
        WHEN attempts >= max_attempts THEN 'failed'
        ELSE 'pending'
      END,
      last_error = error_message,
      started_at = NULL
  WHERE id = queue_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURE get_classification_stats
-- ============================================================================

DROP FUNCTION IF EXISTS get_classification_stats(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_classification_stats(p_office_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  email_type TEXT,
  count BIGINT,
  avg_confidence NUMERIC
) AS $$
BEGIN
  -- SECURITY: Verify user has access to this office
  IF public.get_user_office_id() != p_office_id THEN
    RAISE EXCEPTION 'Access denied: You can only view stats for your office';
  END IF;

  RETURN QUERY
  SELECT
    m.email_type,
    COUNT(*)::BIGINT,
    ROUND(AVG(m.classification_confidence)::NUMERIC, 2)
  FROM messages m
  WHERE m.office_id = p_office_id
    AND m.ai_processed_at IS NOT NULL
    AND m.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY m.email_type
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURE get_tag_stats
-- ============================================================================

DROP FUNCTION IF EXISTS get_tag_stats(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_tag_stats(p_office_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  tag_name TEXT,
  tag_color TEXT,
  message_count BIGINT,
  ai_assigned_count BIGINT,
  user_assigned_count BIGINT
) AS $$
BEGIN
  -- SECURITY: Verify user has access to this office
  IF public.get_user_office_id() != p_office_id THEN
    RAISE EXCEPTION 'Access denied: You can only view stats for your office';
  END IF;

  RETURN QUERY
  SELECT
    t.name,
    t.color,
    COUNT(mt.id)::BIGINT,
    COUNT(mt.id) FILTER (WHERE mt.added_by = 'ai')::BIGINT,
    COUNT(mt.id) FILTER (WHERE mt.added_by = 'user')::BIGINT
  FROM tags t
  LEFT JOIN message_tags mt ON t.id = mt.tag_id
  LEFT JOIN messages m ON mt.message_id = m.id
    AND m.created_at >= NOW() - (p_days || ' days')::INTERVAL
  WHERE t.office_id = p_office_id
  GROUP BY t.id, t.name, t.color
  ORDER BY COUNT(mt.id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADD RATE LIMITING TABLE (for server-side rate limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL, -- Can be IP, user_id, or composite key
  action TEXT NOT NULL, -- 'login', 'api', 'email-send', etc.
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(identifier, action, window_start);

-- Cleanup function for old rate limit records
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS VOID AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RATE LIMITING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_start TIMESTAMPTZ;
BEGIN
  window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Get current count within window
  SELECT COALESCE(SUM(count), 0) INTO current_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
    AND rate_limits.window_start >= window_start;

  -- Check if over limit
  IF current_count >= p_max_requests THEN
    RETURN FALSE; -- Rate limited
  END IF;

  -- Increment counter
  INSERT INTO rate_limits (identifier, action, count, window_start)
  VALUES (p_identifier, p_action, 1, NOW())
  ON CONFLICT (id) DO UPDATE SET count = rate_limits.count + 1;

  RETURN TRUE; -- Allowed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
