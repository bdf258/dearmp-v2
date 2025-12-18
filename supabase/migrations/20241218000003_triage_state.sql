-- ============================================================================
-- Triage State Database Migration
-- ============================================================================
-- This migration adds formal triage state tracking to handle the flow:
--   pending → triaged (AI processed) → confirmed (human approved) | dismissed
--
-- Includes:
-- - Triage status enum and message columns
-- - Performance indexes on messages, message_recipients, tag_assignments
-- - RLS policies for office-based isolation
-- - Audit logging hooks for triage operations
-- - RPC functions for triage actions
-- ============================================================================

-- ============================================================================
-- PART 1: ENUM AND COLUMN ADDITIONS
-- ============================================================================

-- Create triage_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'triage_status') THEN
        CREATE TYPE public.triage_status AS ENUM (
            'pending',    -- New message, not yet AI-processed
            'triaged',    -- AI has processed and made suggestions
            'confirmed',  -- Human has confirmed/approved triage
            'dismissed'   -- Human has dismissed (spam, irrelevant, etc.)
        );
    END IF;
END $$;

-- Add triage-related columns to messages table
-- Note: This alters the parent partitioned table which propagates to all partitions
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS triage_status triage_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS triaged_at timestamptz,
ADD COLUMN IF NOT EXISTS triaged_by text,  -- AI model/system identifier
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS triage_metadata jsonb DEFAULT '{}'::jsonb;

-- Add additional AI processing columns if not present
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz,
ADD COLUMN IF NOT EXISTS classification_confidence numeric(3,2),
ADD COLUMN IF NOT EXISTS classification_reasoning text,
ADD COLUMN IF NOT EXISTS email_type text,
ADD COLUMN IF NOT EXISTS is_policy_email boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_campaign_email boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fingerprint_hash text;

-- Add triage audit action to enum if not exists
DO $$
BEGIN
    -- Check if 'triage_confirm' already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.audit_action'::regtype
        AND enumlabel = 'triage_confirm'
    ) THEN
        ALTER TYPE public.audit_action ADD VALUE 'triage_confirm';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.audit_action'::regtype
        AND enumlabel = 'triage_dismiss'
    ) THEN
        ALTER TYPE public.audit_action ADD VALUE 'triage_dismiss';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.audit_action'::regtype
        AND enumlabel = 'triage_batch'
    ) THEN
        ALTER TYPE public.audit_action ADD VALUE 'triage_batch';
    END IF;
END $$;

-- ============================================================================
-- PART 2: PERFORMANCE INDEXES
-- ============================================================================

-- Index on messages.received_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_messages_received_at
ON public.messages (received_at DESC);

-- Partial index for messages with received_at within triage window (last 30 days)
CREATE INDEX IF NOT EXISTS idx_messages_received_at_recent
ON public.messages (received_at DESC)
WHERE received_at > (now() - interval '30 days');

-- Index on messages.case_id for case-message lookups
CREATE INDEX IF NOT EXISTS idx_messages_case_id
ON public.messages (case_id)
WHERE case_id IS NOT NULL;

-- Composite index for triage queue queries
CREATE INDEX IF NOT EXISTS idx_messages_triage_queue
ON public.messages (office_id, triage_status, received_at DESC)
WHERE triage_status IN ('pending', 'triaged');

-- Index on message_recipients.email_address for constituent matching
CREATE INDEX IF NOT EXISTS idx_message_recipients_email
ON public.message_recipients (email_address);

-- Partial index for 'from' recipients (most common lookup)
CREATE INDEX IF NOT EXISTS idx_message_recipients_from_email
ON public.message_recipients (email_address, message_id)
WHERE recipient_type = 'from';

-- Index on tag_assignments for polymorphic lookups (entity_type, entity_id)
-- Note: idx_tag_assign_entity already exists, but let's add a covering index
CREATE INDEX IF NOT EXISTS idx_tag_assignments_entity_lookup
ON public.tag_assignments (entity_type, entity_id, tag_id);

-- Index for tag_assignments by office for RLS performance
CREATE INDEX IF NOT EXISTS idx_tag_assignments_office
ON public.tag_assignments (office_id);

-- ============================================================================
-- PART 3: RLS POLICIES
-- ============================================================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_assignments ENABLE ROW LEVEL SECURITY;

-- Messages: Already has "Messages office policy" - add triage-specific policies

-- Policy: Staff can update triage status on messages in their office
DROP POLICY IF EXISTS "Staff can update triage status" ON public.messages;
CREATE POLICY "Staff can update triage status" ON public.messages
FOR UPDATE TO authenticated
USING (
    office_id = get_my_office_id()
    AND (
        SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'staff')
)
WITH CHECK (
    office_id = get_my_office_id()
);

-- Policy: Service role can update messages (for AI processing)
DROP POLICY IF EXISTS "Service role can process messages" ON public.messages;
CREATE POLICY "Service role can process messages" ON public.messages
FOR UPDATE TO service_role
USING (true)
WITH CHECK (true);

-- Message Recipients: Ensure office-based isolation
DROP POLICY IF EXISTS "Message recipients office policy" ON public.message_recipients;
CREATE POLICY "Message recipients office policy" ON public.message_recipients
FOR ALL TO authenticated
USING (office_id = get_my_office_id())
WITH CHECK (office_id = get_my_office_id());

-- Service role access for message recipients
DROP POLICY IF EXISTS "Service role message recipients" ON public.message_recipients;
CREATE POLICY "Service role message recipients" ON public.message_recipients
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Tag Assignments: Ensure Tag Assign Policy covers triage tagging
-- Already exists: "Tag Assign Policy" - verify it's sufficient

-- ============================================================================
-- PART 4: AUDIT LOGGING HOOKS
-- ============================================================================

-- Trigger function for triage status changes
CREATE OR REPLACE FUNCTION public.audit_triage_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_action audit_action;
    v_metadata jsonb;
BEGIN
    -- Only log when triage_status changes
    IF OLD.triage_status IS DISTINCT FROM NEW.triage_status THEN
        -- Determine action type
        CASE NEW.triage_status
            WHEN 'confirmed' THEN v_action := 'triage_confirm';
            WHEN 'dismissed' THEN v_action := 'triage_dismiss';
            ELSE v_action := 'update';
        END CASE;

        -- Build metadata
        v_metadata := jsonb_build_object(
            'message_id', NEW.id,
            'subject', LEFT(COALESCE(NEW.subject, ''), 100),
            'previous_status', OLD.triage_status,
            'new_status', NEW.triage_status,
            'case_id', NEW.case_id,
            'campaign_id', NEW.campaign_id,
            'classification_confidence', NEW.classification_confidence,
            'email_type', NEW.email_type
        );

        -- Insert audit log
        INSERT INTO audit_logs (
            office_id,
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata,
            created_at
        ) VALUES (
            NEW.office_id,
            COALESCE(auth.uid(), NEW.confirmed_by),
            v_action,
            'message',
            NEW.id,
            v_metadata,
            now()
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for triage audit on messages table
DROP TRIGGER IF EXISTS triage_audit_trigger ON public.messages;
CREATE TRIGGER triage_audit_trigger
    AFTER UPDATE OF triage_status ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION audit_triage_changes();

-- ============================================================================
-- PART 5: RPC FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC: confirm_triage
-- Confirms one or more messages as triaged (human-approved)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_triage(
    p_message_ids uuid[],
    p_case_id uuid DEFAULT NULL,
    p_assignee_id uuid DEFAULT NULL,
    p_tag_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_office_id uuid;
    v_user_id uuid;
    v_updated_count integer := 0;
    v_message_id uuid;
    v_tag_id uuid;
BEGIN
    -- Get caller context
    v_user_id := auth.uid();
    v_office_id := get_my_office_id();

    IF v_office_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: No office context'
        );
    END IF;

    -- Verify all messages belong to caller's office
    IF EXISTS (
        SELECT 1 FROM messages
        WHERE id = ANY(p_message_ids)
        AND office_id != v_office_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: Messages from different office'
        );
    END IF;

    -- Update messages to confirmed status
    UPDATE messages
    SET
        triage_status = 'confirmed',
        confirmed_at = now(),
        confirmed_by = v_user_id,
        case_id = COALESCE(p_case_id, case_id),
        triage_metadata = triage_metadata || jsonb_build_object(
            'confirmed_at', now(),
            'confirmed_by', v_user_id,
            'assigned_case_id', p_case_id,
            'assigned_to', p_assignee_id,
            'applied_tags', p_tag_ids
        )
    WHERE id = ANY(p_message_ids)
    AND office_id = v_office_id
    AND triage_status IN ('pending', 'triaged');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- Update case assignee if provided
    IF p_case_id IS NOT NULL AND p_assignee_id IS NOT NULL THEN
        UPDATE cases
        SET assigned_to = p_assignee_id
        WHERE id = p_case_id
        AND office_id = v_office_id;
    END IF;

    -- Apply tags to case if provided
    IF p_case_id IS NOT NULL AND p_tag_ids IS NOT NULL THEN
        FOREACH v_tag_id IN ARRAY p_tag_ids
        LOOP
            INSERT INTO tag_assignments (office_id, tag_id, entity_type, entity_id)
            VALUES (v_office_id, v_tag_id, 'case', p_case_id)
            ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING;
        END LOOP;
    END IF;

    -- Log batch triage if multiple messages
    IF array_length(p_message_ids, 1) > 1 THEN
        INSERT INTO audit_logs (
            office_id,
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata,
            created_at
        ) VALUES (
            v_office_id,
            v_user_id,
            'triage_batch',
            'messages',
            p_message_ids[1], -- Reference first message
            jsonb_build_object(
                'message_count', array_length(p_message_ids, 1),
                'message_ids', p_message_ids,
                'case_id', p_case_id,
                'assignee_id', p_assignee_id,
                'tag_ids', p_tag_ids
            ),
            now()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'confirmed_count', v_updated_count,
        'case_id', p_case_id
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: dismiss_triage
-- Dismisses one or more messages (spam, irrelevant, etc.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dismiss_triage(
    p_message_ids uuid[],
    p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_office_id uuid;
    v_user_id uuid;
    v_updated_count integer := 0;
BEGIN
    -- Get caller context
    v_user_id := auth.uid();
    v_office_id := get_my_office_id();

    IF v_office_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: No office context'
        );
    END IF;

    -- Verify all messages belong to caller's office
    IF EXISTS (
        SELECT 1 FROM messages
        WHERE id = ANY(p_message_ids)
        AND office_id != v_office_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: Messages from different office'
        );
    END IF;

    -- Update messages to dismissed status
    UPDATE messages
    SET
        triage_status = 'dismissed',
        confirmed_at = now(),
        confirmed_by = v_user_id,
        triage_metadata = triage_metadata || jsonb_build_object(
            'dismissed_at', now(),
            'dismissed_by', v_user_id,
            'dismiss_reason', p_reason
        )
    WHERE id = ANY(p_message_ids)
    AND office_id = v_office_id
    AND triage_status IN ('pending', 'triaged');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'dismissed_count', v_updated_count
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: get_triage_queue
-- Retrieves messages pending triage with filtering and pagination
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_triage_queue(
    p_status triage_status[] DEFAULT ARRAY['pending', 'triaged']::triage_status[],
    p_campaign_id uuid DEFAULT NULL,
    p_email_type text DEFAULT NULL,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0,
    p_order_by text DEFAULT 'received_at',
    p_order_dir text DEFAULT 'desc'
)
RETURNS TABLE (
    id uuid,
    office_id uuid,
    subject text,
    snippet text,
    received_at timestamptz,
    triage_status triage_status,
    triaged_at timestamptz,
    email_type text,
    is_campaign_email boolean,
    campaign_id uuid,
    case_id uuid,
    classification_confidence numeric,
    triage_metadata jsonb,
    sender_email text,
    sender_name text,
    sender_constituent_id uuid,
    sender_constituent_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_office_id uuid;
BEGIN
    v_office_id := get_my_office_id();

    IF v_office_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        m.id,
        m.office_id,
        m.subject,
        m.snippet,
        m.received_at,
        m.triage_status,
        m.triaged_at,
        m.email_type,
        m.is_campaign_email,
        m.campaign_id,
        m.case_id,
        m.classification_confidence,
        m.triage_metadata,
        mr.email_address as sender_email,
        mr.name as sender_name,
        mr.constituent_id as sender_constituent_id,
        c.full_name as sender_constituent_name
    FROM messages m
    LEFT JOIN message_recipients mr
        ON m.id = mr.message_id AND mr.recipient_type = 'from'
    LEFT JOIN constituents c
        ON mr.constituent_id = c.id
    WHERE m.office_id = v_office_id
    AND m.direction = 'inbound'
    AND m.triage_status = ANY(p_status)
    AND (p_campaign_id IS NULL OR m.campaign_id = p_campaign_id)
    AND (p_email_type IS NULL OR m.email_type = p_email_type)
    ORDER BY
        CASE WHEN p_order_by = 'received_at' AND p_order_dir = 'desc'
            THEN m.received_at END DESC NULLS LAST,
        CASE WHEN p_order_by = 'received_at' AND p_order_dir = 'asc'
            THEN m.received_at END ASC NULLS LAST,
        CASE WHEN p_order_by = 'confidence' AND p_order_dir = 'desc'
            THEN m.classification_confidence END DESC NULLS LAST,
        CASE WHEN p_order_by = 'confidence' AND p_order_dir = 'asc'
            THEN m.classification_confidence END ASC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: get_triage_stats
-- Returns triage queue statistics for dashboard
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_triage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_office_id uuid;
    v_result jsonb;
BEGIN
    v_office_id := get_my_office_id();

    IF v_office_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Unauthorized');
    END IF;

    SELECT jsonb_build_object(
        'pending_count', COUNT(*) FILTER (WHERE triage_status = 'pending'),
        'triaged_count', COUNT(*) FILTER (WHERE triage_status = 'triaged'),
        'confirmed_today', COUNT(*) FILTER (
            WHERE triage_status = 'confirmed'
            AND confirmed_at >= date_trunc('day', now())
        ),
        'dismissed_today', COUNT(*) FILTER (
            WHERE triage_status = 'dismissed'
            AND confirmed_at >= date_trunc('day', now())
        ),
        'by_email_type', (
            SELECT jsonb_object_agg(COALESCE(email_type, 'unknown'), cnt)
            FROM (
                SELECT email_type, COUNT(*) as cnt
                FROM messages
                WHERE office_id = v_office_id
                AND direction = 'inbound'
                AND triage_status IN ('pending', 'triaged')
                GROUP BY email_type
            ) sub
        ),
        'by_campaign', (
            SELECT jsonb_object_agg(COALESCE(camp.name, 'uncategorized'), cnt)
            FROM (
                SELECT campaign_id, COUNT(*) as cnt
                FROM messages
                WHERE office_id = v_office_id
                AND direction = 'inbound'
                AND triage_status IN ('pending', 'triaged')
                GROUP BY campaign_id
            ) sub
            LEFT JOIN campaigns camp ON camp.id = sub.campaign_id
        ),
        'avg_confidence', (
            SELECT ROUND(AVG(classification_confidence)::numeric, 2)
            FROM messages
            WHERE office_id = v_office_id
            AND direction = 'inbound'
            AND triage_status IN ('pending', 'triaged')
            AND classification_confidence IS NOT NULL
        )
    ) INTO v_result
    FROM messages
    WHERE office_id = v_office_id
    AND direction = 'inbound';

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: mark_as_triaged
-- Called by AI processing to mark messages as AI-triaged
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_as_triaged(
    p_message_id uuid,
    p_triaged_by text,
    p_confidence numeric DEFAULT NULL,
    p_email_type text DEFAULT NULL,
    p_is_campaign boolean DEFAULT false,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Service role or authenticated with office access
    IF auth.role() != 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = p_message_id
            AND m.office_id = get_my_office_id()
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Unauthorized'
            );
        END IF;
    END IF;

    UPDATE messages
    SET
        triage_status = 'triaged',
        triaged_at = now(),
        triaged_by = p_triaged_by,
        ai_processed_at = now(),
        classification_confidence = COALESCE(p_confidence, classification_confidence),
        email_type = COALESCE(p_email_type, email_type),
        is_campaign_email = COALESCE(p_is_campaign, is_campaign_email),
        triage_metadata = triage_metadata || p_metadata
    WHERE id = p_message_id
    AND triage_status = 'pending';

    RETURN jsonb_build_object(
        'success', true,
        'message_id', p_message_id
    );
END;
$$;

-- ============================================================================
-- PART 6: GRANTS
-- ============================================================================

-- Grant execute on triage RPCs to authenticated users
GRANT EXECUTE ON FUNCTION public.confirm_triage TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_triage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_triage_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_triage_stats TO authenticated;

-- Service role for AI processing
GRANT EXECUTE ON FUNCTION public.mark_as_triaged TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_as_triaged TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TYPE public.triage_status IS 'Tracks the state of message triage: pending → triaged → confirmed/dismissed';
COMMENT ON FUNCTION public.confirm_triage IS 'Confirms one or more messages as triaged, optionally linking to case and applying tags';
COMMENT ON FUNCTION public.dismiss_triage IS 'Dismisses one or more messages from triage queue (spam, irrelevant, etc.)';
COMMENT ON FUNCTION public.get_triage_queue IS 'Retrieves messages pending triage with filtering and pagination';
COMMENT ON FUNCTION public.get_triage_stats IS 'Returns triage queue statistics for dashboard display';
COMMENT ON FUNCTION public.mark_as_triaged IS 'Called by AI processing to mark messages as AI-triaged with suggestions';
