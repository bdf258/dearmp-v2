-- Session Binding / IP Binding Migration
-- Implements session context tracking and anomaly detection
-- Part of security enhancement priority #3

-- ============================================================================
-- 1. SESSION CONTEXT TRACKING TABLE
-- Tracks the context (IP, user agent, country) for each session
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL, -- From JWT jti claim or session identifier

    -- Binding context
    ip_address INET NOT NULL,
    ip_subnet CIDR, -- Will be calculated on insert
    user_agent TEXT,
    user_agent_hash TEXT, -- Hash of user agent for comparison
    country_code TEXT, -- From GeoIP lookup (optional)

    -- Risk assessment
    risk_score INTEGER DEFAULT 0,
    is_trusted BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, session_id)
);

-- ============================================================================
-- 2. SESSION ANOMALIES TABLE
-- Records detected anomalies for investigation
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,

    anomaly_type TEXT NOT NULL, -- ip_change, ua_change, country_change, time_anomaly
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- Context at time of anomaly
    expected_value TEXT,
    actual_value TEXT,

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution TEXT, -- user_verified, admin_dismissed, session_terminated

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. TRUSTED CONTEXTS TABLE
-- Stores known/trusted contexts per user for reduced false positives
-- ============================================================================
CREATE TABLE IF NOT EXISTS trusted_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    context_type TEXT NOT NULL, -- ip_subnet, user_agent_hash, country
    context_value TEXT NOT NULL,

    -- Trust metadata
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    use_count INTEGER DEFAULT 1,
    trusted_at TIMESTAMPTZ, -- When explicitly trusted by user

    UNIQUE(user_id, context_type, context_value)
);

-- ============================================================================
-- 4. HELPER FUNCTION: Calculate IP Subnet
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_ip_subnet(ip INET)
RETURNS CIDR AS $$
BEGIN
    RETURN set_masklen(ip, 24);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 5. HELPER FUNCTION: Generate User Agent Hash
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_ua_hash(user_agent TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(sha256(COALESCE(user_agent, '')::bytea), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. FUNCTION: Add or Update Trusted Context
-- ============================================================================
CREATE OR REPLACE FUNCTION add_or_update_trusted_context(
    p_user_id UUID,
    p_type TEXT,
    p_value TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO trusted_contexts (user_id, context_type, context_value)
    VALUES (p_user_id, p_type, p_value)
    ON CONFLICT (user_id, context_type, context_value)
    DO UPDATE SET
        last_used_at = NOW(),
        use_count = trusted_contexts.use_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 7. FUNCTION: Record Session Context
-- Main function that records context and checks for anomalies
-- ============================================================================
CREATE OR REPLACE FUNCTION record_session_context(
    p_ip_address TEXT,
    p_user_agent TEXT,
    p_country_code TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_ip INET;
    v_ip_subnet CIDR;
    v_ua_hash TEXT;
    v_existing_context RECORD;
    v_anomalies jsonb := '[]'::jsonb;
    v_risk_score INTEGER := 0;
    v_office_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Get session ID from JWT claims, fallback to a generated one
    BEGIN
        v_session_id := current_setting('request.jwt.claims', true)::json->>'session_id';
    EXCEPTION WHEN OTHERS THEN
        v_session_id := NULL;
    END;

    -- If no session_id in JWT, use the access token hash as session identifier
    IF v_session_id IS NULL THEN
        BEGIN
            v_session_id := encode(sha256(current_setting('request.jwt.claim.sub', true)::bytea || NOW()::text::bytea), 'hex');
        EXCEPTION WHEN OTHERS THEN
            v_session_id := encode(sha256(v_user_id::text::bytea || NOW()::text::bytea), 'hex');
        END;
    END IF;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'No valid session', 'risk_score', 0, 'anomalies', '[]'::jsonb, 'action_required', false);
    END IF;

    -- Parse IP address
    BEGIN
        v_ip := p_ip_address::INET;
    EXCEPTION WHEN OTHERS THEN
        v_ip := '0.0.0.0'::INET;
    END;

    v_ip_subnet := calculate_ip_subnet(v_ip);
    v_ua_hash := generate_ua_hash(p_user_agent);

    -- Get user's office_id for audit logging
    SELECT office_id INTO v_office_id FROM profiles WHERE id = v_user_id;

    -- Get or create session context
    SELECT * INTO v_existing_context
    FROM session_contexts
    WHERE user_id = v_user_id
    ORDER BY last_seen_at DESC
    LIMIT 1;

    IF v_existing_context IS NULL THEN
        -- First request from this user - record initial context
        INSERT INTO session_contexts (
            user_id, session_id, ip_address, ip_subnet, user_agent, user_agent_hash, country_code
        ) VALUES (
            v_user_id, v_session_id, v_ip, v_ip_subnet, p_user_agent, v_ua_hash, p_country_code
        )
        ON CONFLICT (user_id, session_id) DO UPDATE SET
            last_seen_at = NOW();

        -- Add to trusted contexts (auto-trust first seen)
        PERFORM add_or_update_trusted_context(v_user_id, 'ip_subnet', v_ip_subnet::text);
        PERFORM add_or_update_trusted_context(v_user_id, 'user_agent_hash', v_ua_hash);

        IF p_country_code IS NOT NULL THEN
            PERFORM add_or_update_trusted_context(v_user_id, 'country', p_country_code);
        END IF;

    ELSE
        -- Check for anomalies against most recent session context

        -- IP change detection
        IF v_existing_context.ip_subnet IS NOT NULL AND v_existing_context.ip_subnet != v_ip_subnet THEN
            v_anomalies := v_anomalies || jsonb_build_object(
                'type', 'ip_change',
                'expected', v_existing_context.ip_address::text,
                'actual', v_ip::text
            );
            v_risk_score := v_risk_score + 30;

            -- Check if new IP is in trusted contexts
            IF NOT EXISTS (
                SELECT 1 FROM trusted_contexts
                WHERE user_id = v_user_id
                AND context_type = 'ip_subnet'
                AND context_value = v_ip_subnet::text
                AND trusted_at IS NOT NULL
            ) THEN
                v_risk_score := v_risk_score + 20;
            END IF;
        END IF;

        -- User agent change detection
        IF v_existing_context.user_agent_hash IS NOT NULL AND v_existing_context.user_agent_hash != v_ua_hash THEN
            v_anomalies := v_anomalies || jsonb_build_object(
                'type', 'ua_change',
                'expected', COALESCE(v_existing_context.user_agent, 'unknown'),
                'actual', COALESCE(p_user_agent, 'unknown')
            );
            v_risk_score := v_risk_score + 20;
        END IF;

        -- Country change detection (highest severity)
        IF v_existing_context.country_code IS NOT NULL
           AND p_country_code IS NOT NULL
           AND v_existing_context.country_code != p_country_code THEN
            v_anomalies := v_anomalies || jsonb_build_object(
                'type', 'country_change',
                'expected', v_existing_context.country_code,
                'actual', p_country_code
            );
            v_risk_score := v_risk_score + 50;
        END IF;

        -- Update or insert session context
        INSERT INTO session_contexts (
            user_id, session_id, ip_address, ip_subnet, user_agent, user_agent_hash, country_code, risk_score
        ) VALUES (
            v_user_id, v_session_id, v_ip, v_ip_subnet, p_user_agent, v_ua_hash, p_country_code, v_risk_score
        )
        ON CONFLICT (user_id, session_id) DO UPDATE SET
            risk_score = v_risk_score,
            last_seen_at = NOW();

        -- Record anomalies if found
        IF jsonb_array_length(v_anomalies) > 0 THEN
            FOR i IN 0..jsonb_array_length(v_anomalies)-1 LOOP
                INSERT INTO session_anomalies (
                    user_id, session_id, anomaly_type, severity,
                    expected_value, actual_value
                ) VALUES (
                    v_user_id,
                    v_session_id,
                    v_anomalies->i->>'type',
                    CASE
                        WHEN v_risk_score >= 50 THEN 'critical'
                        WHEN v_risk_score >= 30 THEN 'high'
                        WHEN v_risk_score >= 15 THEN 'medium'
                        ELSE 'low'
                    END,
                    v_anomalies->i->>'expected',
                    v_anomalies->i->>'actual'
                );
            END LOOP;

            -- Log to audit for critical anomalies
            IF v_risk_score >= 50 AND v_office_id IS NOT NULL THEN
                INSERT INTO audit_logs (
                    office_id, actor_id, action, entity_type, metadata
                ) VALUES (
                    v_office_id,
                    v_user_id,
                    'session_anomaly',
                    'session',
                    jsonb_build_object(
                        'risk_score', v_risk_score,
                        'anomalies', v_anomalies,
                        'session_id', v_session_id,
                        'ip_address', v_ip::text
                    )
                );
            END IF;
        END IF;

        -- Update trusted context usage
        PERFORM add_or_update_trusted_context(v_user_id, 'ip_subnet', v_ip_subnet::text);
        PERFORM add_or_update_trusted_context(v_user_id, 'user_agent_hash', v_ua_hash);
    END IF;

    RETURN jsonb_build_object(
        'risk_score', v_risk_score,
        'anomalies', v_anomalies,
        'action_required', v_risk_score >= 50
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 8. FUNCTION: Trust Current Context
-- Allows users to mark their current context as trusted
-- ============================================================================
CREATE OR REPLACE FUNCTION trust_current_context()
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_context RECORD;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No valid session');
    END IF;

    SELECT * INTO v_context
    FROM session_contexts
    WHERE user_id = v_user_id
    ORDER BY last_seen_at DESC
    LIMIT 1;

    IF v_context IS NOT NULL THEN
        -- Trust the IP subnet
        UPDATE trusted_contexts
        SET trusted_at = NOW()
        WHERE user_id = v_user_id
        AND context_type = 'ip_subnet'
        AND context_value = v_context.ip_subnet::text;

        -- Trust the user agent
        UPDATE trusted_contexts
        SET trusted_at = NOW()
        WHERE user_id = v_user_id
        AND context_type = 'user_agent_hash'
        AND context_value = v_context.user_agent_hash;

        -- Resolve any unresolved anomalies for this user
        UPDATE session_anomalies
        SET resolved_at = NOW(), resolution = 'user_verified'
        WHERE user_id = v_user_id
        AND resolved_at IS NULL;

        -- Reset risk score on current session
        UPDATE session_contexts
        SET risk_score = 0, is_trusted = true
        WHERE id = v_context.id;

        RETURN jsonb_build_object('success', true);
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'No session context found');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 9. FUNCTION: Get User's Trusted Contexts
-- Returns all trusted contexts for the current user
-- ============================================================================
CREATE OR REPLACE FUNCTION get_trusted_contexts()
RETURNS TABLE (
    context_type TEXT,
    context_value TEXT,
    first_seen_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    use_count INTEGER,
    is_trusted BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.context_type,
        tc.context_value,
        tc.first_seen_at,
        tc.last_used_at,
        tc.use_count,
        tc.trusted_at IS NOT NULL as is_trusted
    FROM trusted_contexts tc
    WHERE tc.user_id = auth.uid()
    ORDER BY tc.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 10. FUNCTION: Get Unresolved Anomalies
-- Returns anomalies that need user attention
-- ============================================================================
CREATE OR REPLACE FUNCTION get_unresolved_anomalies()
RETURNS TABLE (
    id UUID,
    anomaly_type TEXT,
    severity TEXT,
    expected_value TEXT,
    actual_value TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sa.id,
        sa.anomaly_type,
        sa.severity,
        sa.expected_value,
        sa.actual_value,
        sa.created_at
    FROM session_anomalies sa
    WHERE sa.user_id = auth.uid()
    AND sa.resolved_at IS NULL
    ORDER BY sa.created_at DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 11. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_session_contexts_user_session
    ON session_contexts(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_session_contexts_user_last_seen
    ON session_contexts(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_anomalies_user_unresolved
    ON session_anomalies(user_id, created_at DESC)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trusted_contexts_user_type
    ON trusted_contexts(user_id, context_type);

-- ============================================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE session_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_contexts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own session data
CREATE POLICY "Users can view own session contexts"
    ON session_contexts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can view own session anomalies"
    ON session_anomalies FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can view own trusted contexts"
    ON trusted_contexts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Service role has full access (for system operations)
CREATE POLICY "Service role full access to session_contexts"
    ON session_contexts FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to session_anomalies"
    ON session_anomalies FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to trusted_contexts"
    ON trusted_contexts FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 13. AUDIT LOG ENTRY FOR THIS MIGRATION
-- ============================================================================
DO $$
BEGIN
    INSERT INTO public.audit_logs (
        office_id,
        actor_id,
        action,
        entity_type,
        metadata,
        created_at
    )
    SELECT
        id,
        NULL,
        'update'::audit_action,
        'security_migration',
        jsonb_build_object(
            'migration', '20241218000001_session_binding',
            'features', ARRAY[
                'Session context tracking (IP, user agent, country)',
                'Anomaly detection for IP changes, user agent changes, country changes',
                'Trusted contexts management',
                'Risk scoring system',
                'Automatic audit logging for critical anomalies'
            ]
        ),
        NOW()
    FROM public.offices;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
