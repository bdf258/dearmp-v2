-- ============================================================================
-- TRIAGE SUGGESTIONS TABLE
-- ============================================================================
-- Stores LLM-generated triage suggestions separately from messages.
-- This keeps public.messages clean while preserving full LLM analysis details
-- for debugging, auditing, and ML improvement.
--
-- Works for both legacy.emails and public.messages via email_id reference.
-- ============================================================================

-- Create the triage_suggestions table
CREATE TABLE IF NOT EXISTS public.triage_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to the email (works for both legacy.emails and public.messages)
    email_id UUID NOT NULL,
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processing_duration_ms INTEGER,

    -- Model info
    model TEXT NOT NULL,  -- e.g., 'gemini-2.0-flash'

    -- Classification results
    email_type TEXT,  -- casework, policy, campaign, spam, personal, other
    email_type_confidence NUMERIC(3,2),  -- 0.00 to 1.00
    classification_reasoning TEXT,

    -- Action recommendation
    recommended_action TEXT,  -- create_case, add_to_existing, assign_campaign, mark_spam, ignore
    action_confidence NUMERIC(3,2),
    action_reasoning TEXT,

    -- Suggested values (IDs reference legacy reference data)
    suggested_case_type_id INTEGER,
    suggested_category_id INTEGER,
    suggested_status_id INTEGER,
    suggested_assignee_id INTEGER,
    suggested_priority TEXT,  -- low, medium, high, urgent
    suggested_tags JSONB DEFAULT '[]'::jsonb,

    -- Matched entities
    matched_constituent_id UUID,
    matched_constituent_external_id INTEGER,
    matched_constituent_confidence NUMERIC(3,2),
    matched_cases JSONB DEFAULT '[]'::jsonb,  -- Array of {id, externalId, summary, relevanceScore}
    matched_campaign_id UUID,

    -- For linking to existing case (when action is add_to_existing)
    suggested_existing_case_id UUID,
    suggested_existing_case_external_id INTEGER,

    -- Full LLM debug info (for development/debugging)
    full_prompt TEXT,
    raw_response TEXT,
    parsed_response JSONB,

    -- Whether this suggestion was accepted/rejected by user
    user_decision TEXT,  -- accepted, modified, rejected, pending
    user_decision_at TIMESTAMPTZ,
    user_decision_by UUID REFERENCES auth.users(id),
    user_modifications JSONB,  -- What the user changed

    -- Indexes will be created below
    CONSTRAINT valid_email_type CHECK (email_type IS NULL OR email_type IN ('casework', 'policy', 'campaign', 'spam', 'personal', 'other')),
    CONSTRAINT valid_action CHECK (recommended_action IS NULL OR recommended_action IN ('create_case', 'add_to_existing', 'assign_campaign', 'mark_spam', 'ignore')),
    CONSTRAINT valid_priority CHECK (suggested_priority IS NULL OR suggested_priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT valid_decision CHECK (user_decision IS NULL OR user_decision IN ('accepted', 'modified', 'rejected', 'pending'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_triage_suggestions_email
    ON public.triage_suggestions(email_id);

CREATE INDEX IF NOT EXISTS idx_triage_suggestions_office
    ON public.triage_suggestions(office_id);

CREATE INDEX IF NOT EXISTS idx_triage_suggestions_created
    ON public.triage_suggestions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triage_suggestions_office_pending
    ON public.triage_suggestions(office_id, created_at DESC)
    WHERE user_decision IS NULL OR user_decision = 'pending';

-- Enable RLS
ALTER TABLE public.triage_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Triage suggestions office policy" ON public.triage_suggestions;
CREATE POLICY "Triage suggestions office policy" ON public.triage_suggestions
    FOR ALL TO authenticated
    USING (office_id = get_my_office_id())
    WITH CHECK (office_id = get_my_office_id());

DROP POLICY IF EXISTS "Service role triage suggestions" ON public.triage_suggestions;
CREATE POLICY "Service role triage suggestions" ON public.triage_suggestions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- RPC: save_triage_suggestion
-- Called by the worker to save LLM triage results
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_triage_suggestion(
    p_email_id UUID,
    p_office_id UUID,
    p_model TEXT,
    p_email_type TEXT DEFAULT NULL,
    p_email_type_confidence NUMERIC DEFAULT NULL,
    p_classification_reasoning TEXT DEFAULT NULL,
    p_recommended_action TEXT DEFAULT NULL,
    p_action_confidence NUMERIC DEFAULT NULL,
    p_action_reasoning TEXT DEFAULT NULL,
    p_suggested_case_type_id INTEGER DEFAULT NULL,
    p_suggested_category_id INTEGER DEFAULT NULL,
    p_suggested_status_id INTEGER DEFAULT NULL,
    p_suggested_assignee_id INTEGER DEFAULT NULL,
    p_suggested_priority TEXT DEFAULT NULL,
    p_suggested_tags JSONB DEFAULT '[]'::jsonb,
    p_matched_constituent_id UUID DEFAULT NULL,
    p_matched_constituent_external_id INTEGER DEFAULT NULL,
    p_matched_constituent_confidence NUMERIC DEFAULT NULL,
    p_matched_cases JSONB DEFAULT '[]'::jsonb,
    p_matched_campaign_id UUID DEFAULT NULL,
    p_suggested_existing_case_id UUID DEFAULT NULL,
    p_suggested_existing_case_external_id INTEGER DEFAULT NULL,
    p_full_prompt TEXT DEFAULT NULL,
    p_raw_response TEXT DEFAULT NULL,
    p_parsed_response JSONB DEFAULT NULL,
    p_processing_duration_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_suggestion_id UUID;
BEGIN
    INSERT INTO triage_suggestions (
        email_id,
        office_id,
        model,
        email_type,
        email_type_confidence,
        classification_reasoning,
        recommended_action,
        action_confidence,
        action_reasoning,
        suggested_case_type_id,
        suggested_category_id,
        suggested_status_id,
        suggested_assignee_id,
        suggested_priority,
        suggested_tags,
        matched_constituent_id,
        matched_constituent_external_id,
        matched_constituent_confidence,
        matched_cases,
        matched_campaign_id,
        suggested_existing_case_id,
        suggested_existing_case_external_id,
        full_prompt,
        raw_response,
        parsed_response,
        processing_duration_ms,
        user_decision
    ) VALUES (
        p_email_id,
        p_office_id,
        p_model,
        p_email_type,
        p_email_type_confidence,
        p_classification_reasoning,
        p_recommended_action,
        p_action_confidence,
        p_action_reasoning,
        p_suggested_case_type_id,
        p_suggested_category_id,
        p_suggested_status_id,
        p_suggested_assignee_id,
        p_suggested_priority,
        p_suggested_tags,
        p_matched_constituent_id,
        p_matched_constituent_external_id,
        p_matched_constituent_confidence,
        p_matched_cases,
        p_matched_campaign_id,
        p_suggested_existing_case_id,
        p_suggested_existing_case_external_id,
        p_full_prompt,
        p_raw_response,
        p_parsed_response,
        p_processing_duration_ms,
        'pending'
    )
    RETURNING id INTO v_suggestion_id;

    RETURN v_suggestion_id;
END;
$$;

-- ============================================================================
-- RPC: get_triage_suggestion
-- Get the latest triage suggestion for an email
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_triage_suggestion(p_email_id UUID)
RETURNS TABLE (
    id UUID,
    email_id UUID,
    office_id UUID,
    created_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,
    model TEXT,
    email_type TEXT,
    email_type_confidence NUMERIC,
    classification_reasoning TEXT,
    recommended_action TEXT,
    action_confidence NUMERIC,
    action_reasoning TEXT,
    suggested_case_type_id INTEGER,
    suggested_category_id INTEGER,
    suggested_status_id INTEGER,
    suggested_assignee_id INTEGER,
    suggested_priority TEXT,
    suggested_tags JSONB,
    matched_constituent_id UUID,
    matched_constituent_external_id INTEGER,
    matched_constituent_confidence NUMERIC,
    matched_cases JSONB,
    matched_campaign_id UUID,
    suggested_existing_case_id UUID,
    suggested_existing_case_external_id INTEGER,
    full_prompt TEXT,
    raw_response TEXT,
    parsed_response JSONB,
    user_decision TEXT,
    user_decision_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ts.id,
        ts.email_id,
        ts.office_id,
        ts.created_at,
        ts.processing_duration_ms,
        ts.model,
        ts.email_type,
        ts.email_type_confidence,
        ts.classification_reasoning,
        ts.recommended_action,
        ts.action_confidence,
        ts.action_reasoning,
        ts.suggested_case_type_id,
        ts.suggested_category_id,
        ts.suggested_status_id,
        ts.suggested_assignee_id,
        ts.suggested_priority,
        ts.suggested_tags,
        ts.matched_constituent_id,
        ts.matched_constituent_external_id,
        ts.matched_constituent_confidence,
        ts.matched_cases,
        ts.matched_campaign_id,
        ts.suggested_existing_case_id,
        ts.suggested_existing_case_external_id,
        ts.full_prompt,
        ts.raw_response,
        ts.parsed_response,
        ts.user_decision,
        ts.user_decision_at
    FROM triage_suggestions ts
    WHERE ts.email_id = p_email_id
    ORDER BY ts.created_at DESC
    LIMIT 1;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.triage_suggestions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.triage_suggestions TO service_role;
GRANT EXECUTE ON FUNCTION public.save_triage_suggestion TO service_role;
GRANT EXECUTE ON FUNCTION public.get_triage_suggestion TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_triage_suggestion TO service_role;

-- Comments
COMMENT ON TABLE public.triage_suggestions IS 'Stores LLM-generated triage suggestions for emails, including full debug info';
COMMENT ON FUNCTION public.save_triage_suggestion IS 'Save a new triage suggestion from the LLM worker';
COMMENT ON FUNCTION public.get_triage_suggestion IS 'Get the latest triage suggestion for an email';
