-- Enable MFA/2FA for the application
-- This migration sets up the necessary configuration for TOTP-based 2FA

-- Note: Supabase Auth handles MFA storage internally in auth.mfa_factors and auth.mfa_challenges tables
-- We only need to ensure the auth schema extensions are available

-- Add 2FA-related audit action
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'mfa_enroll';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'mfa_unenroll';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'mfa_verify';

-- Create a view to easily check which users have MFA enabled
-- This view joins profiles with auth.mfa_factors to show MFA status
-- Note: auth.mfa_factors is managed by Supabase Auth
CREATE OR REPLACE VIEW user_mfa_status AS
SELECT
    p.id as user_id,
    p.full_name,
    p.office_id,
    p.role,
    EXISTS (
        SELECT 1
        FROM auth.mfa_factors f
        WHERE f.user_id = p.id
        AND f.status = 'verified'
    ) as has_mfa_enabled,
    (
        SELECT COUNT(*)
        FROM auth.mfa_factors f
        WHERE f.user_id = p.id
        AND f.status = 'verified'
    )::integer as verified_factor_count
FROM profiles p;

-- Grant access to the view
GRANT SELECT ON user_mfa_status TO authenticated;

-- RLS policy for the view - users can only see their own MFA status or admins can see all in their office
CREATE POLICY "Users can see own MFA status" ON user_mfa_status
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND role = 'admin'
                AND office_id = user_mfa_status.office_id
            )
        )
    );

-- Function to check if a user requires MFA verification
-- Returns true if user has MFA enabled but session is only aal1
CREATE OR REPLACE FUNCTION requires_mfa_verification()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_aal text;
    has_factors boolean;
BEGIN
    -- Get current assurance level from JWT
    current_aal := coalesce(
        current_setting('request.jwt.claims', true)::json->>'aal',
        'aal1'
    );

    -- Check if user has verified MFA factors
    SELECT EXISTS (
        SELECT 1 FROM auth.mfa_factors
        WHERE user_id = auth.uid()
        AND status = 'verified'
    ) INTO has_factors;

    -- Requires MFA if user has factors but only at aal1
    RETURN has_factors AND current_aal = 'aal1';
END;
$$;

-- Function to get current session assurance level
CREATE OR REPLACE FUNCTION get_session_aal()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN coalesce(
        current_setting('request.jwt.claims', true)::json->>'aal',
        'aal1'
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION requires_mfa_verification() TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_aal() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION requires_mfa_verification() IS 'Check if the current user needs to complete MFA verification. Returns true if user has MFA enabled but session is only aal1.';
COMMENT ON FUNCTION get_session_aal() IS 'Get the current session Authenticator Assurance Level (aal1 or aal2).';
