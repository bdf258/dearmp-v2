-- RPC Functions and Webhook Trigger for Email Ingestion
-- These functions support the email-ingestion edge function

-- ============================================================================
-- RPC FUNCTIONS FOR COUNTER UPDATES
-- ============================================================================

-- Increment campaign email count
CREATE OR REPLACE FUNCTION increment_campaign_count(campaign_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET email_count = COALESCE(email_count, 0) + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment bulk response recipient count
CREATE OR REPLACE FUNCTION increment_bulk_response_recipients(bulk_response_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE bulk_responses
  SET total_recipients = COALESCE(total_recipients, 0) + 1,
      updated_at = NOW()
  WHERE id = bulk_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- WEBHOOK TRIGGER FOR NEW MESSAGES
-- ============================================================================

-- Enable pg_net extension for HTTP calls (if not already enabled)
-- Note: This requires Supabase Pro or self-hosted with pg_net installed
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to call the email-ingestion edge function via webhook
CREATE OR REPLACE FUNCTION call_email_ingestion_webhook()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only process inbound messages that need triage
  IF NEW.direction = 'inbound' AND NEW.is_triage_needed = true AND NEW.ai_processed_at IS NULL THEN
    -- Get the edge function URL from environment (set via Supabase Dashboard)
    edge_function_url := current_setting('app.settings.edge_function_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);

    -- If pg_net is available, make async HTTP call
    -- Otherwise, just log and rely on scheduled job
    IF edge_function_url IS NOT NULL AND edge_function_url != '' THEN
      BEGIN
        -- Attempt to call via pg_net if available
        PERFORM extensions.http_post(
          edge_function_url || '/email-ingestion',
          jsonb_build_object(
            'message_id', NEW.id,
            'office_id', NEW.office_id
          )::text,
          'application/json',
          ARRAY[
            extensions.http_header('Authorization', 'Bearer ' || service_role_key)
          ]
        );
      EXCEPTION WHEN OTHERS THEN
        -- pg_net not available, will rely on queue processing
        RAISE NOTICE 'Could not call webhook: %. Message queued for processing.', SQLERRM;
      END;
    END IF;

    -- Always add to processing queue as fallback
    INSERT INTO ai_processing_queue (message_id, office_id, priority)
    VALUES (
      NEW.id,
      NEW.office_id,
      CASE
        WHEN NEW.subject ILIKE '%urgent%' THEN 10
        WHEN NEW.subject ILIKE '%asap%' THEN 8
        WHEN NEW.subject ILIKE '%important%' THEN 5
        ELSE 0
      END
    )
    ON CONFLICT (message_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_email_ingestion ON messages;

-- Create the trigger
CREATE TRIGGER trigger_email_ingestion
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION call_email_ingestion_webhook();

-- ============================================================================
-- QUEUE PROCESSING FUNCTION (for scheduled job fallback)
-- ============================================================================

-- Function to get next batch of messages for processing
CREATE OR REPLACE FUNCTION get_pending_messages_for_processing(batch_size INTEGER DEFAULT 10)
RETURNS TABLE (
  queue_id UUID,
  message_id UUID,
  office_id UUID
) AS $$
BEGIN
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

-- Function to mark queue item as failed
CREATE OR REPLACE FUNCTION mark_queue_item_failed(
  queue_item_id UUID,
  error_message TEXT
)
RETURNS VOID AS $$
BEGIN
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
-- HELPER VIEWS
-- ============================================================================

-- View for messages pending triage with their classification
CREATE OR REPLACE VIEW messages_pending_triage AS
SELECT
  m.*,
  o.name as office_name,
  o.mode as office_mode,
  u.name as assigned_user_name,
  c.name as campaign_name,
  array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names,
  dr.id as draft_response_id,
  dr.status as draft_response_status
FROM messages m
LEFT JOIN offices o ON m.office_id = o.id
LEFT JOIN users u ON m.assigned_to_user_id = u.id
LEFT JOIN campaigns c ON m.campaign_id = c.id
LEFT JOIN message_tags mt ON m.id = mt.message_id
LEFT JOIN tags t ON mt.tag_id = t.id
LEFT JOIN draft_responses dr ON m.id = dr.message_id AND dr.status = 'draft'
WHERE m.is_triage_needed = true
  AND m.direction = 'inbound'
GROUP BY m.id, o.name, o.mode, u.name, c.name, dr.id, dr.status
ORDER BY m.created_at DESC;

-- View for campaign emails with their bulk response status
CREATE OR REPLACE VIEW campaign_emails_with_status AS
SELECT
  m.id as message_id,
  m.subject,
  m.from_email,
  m.from_name,
  m.fingerprint_hash,
  m.created_at,
  c.id as campaign_id,
  c.name as campaign_name,
  c.email_count,
  br.id as bulk_response_id,
  br.status as bulk_response_status,
  br.subject as bulk_response_subject
FROM messages m
LEFT JOIN campaigns c ON m.campaign_id = c.id
LEFT JOIN bulk_responses br ON m.fingerprint_hash = br.fingerprint_hash
WHERE m.is_campaign_email = true
  AND m.direction = 'inbound'
ORDER BY m.created_at DESC;

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Get email classification stats for an office
CREATE OR REPLACE FUNCTION get_classification_stats(p_office_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  email_type TEXT,
  count BIGINT,
  avg_confidence NUMERIC
) AS $$
BEGIN
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

-- Get tag usage stats for an office
CREATE OR REPLACE FUNCTION get_tag_stats(p_office_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  tag_name TEXT,
  tag_color TEXT,
  message_count BIGINT,
  ai_assigned_count BIGINT,
  user_assigned_count BIGINT
) AS $$
BEGIN
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
