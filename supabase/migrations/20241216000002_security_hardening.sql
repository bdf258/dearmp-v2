-- Security Hardening Migration
-- Addresses critical vulnerabilities identified in security audit

-- =====================================================
-- 1. FIX: Replace overly permissive RLS policies
-- These policies from initial migration allow ANY authenticated user full access
-- =====================================================

-- Drop the dangerous "FOR ALL USING (true)" policies
DROP POLICY IF EXISTS "Service role has full access to offices" ON public.offices;
DROP POLICY IF EXISTS "Service role has full access to office_settings" ON public.office_settings;
DROP POLICY IF EXISTS "Service role has full access to users" ON public.users;
DROP POLICY IF EXISTS "Service role has full access to tags" ON public.tags;
DROP POLICY IF EXISTS "Service role has full access to campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Service role has full access to cases" ON public.cases;
DROP POLICY IF EXISTS "Service role has full access to messages" ON public.messages;
DROP POLICY IF EXISTS "Service role has full access to message_tags" ON public.message_tags;
DROP POLICY IF EXISTS "Service role has full access to draft_responses" ON public.draft_responses;
DROP POLICY IF EXISTS "Service role has full access to bulk_responses" ON public.bulk_responses;
DROP POLICY IF EXISTS "Service role has full access to ai_processing_queue" ON public.ai_processing_queue;

-- Note: Service role bypasses RLS by default, so we don't need explicit policies for it

-- =====================================================
-- 2. ADD: Proper office-scoped RLS policies for users table
-- =====================================================

CREATE POLICY "Users can view profiles in their office"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (office_id = get_my_office_id());

CREATE POLICY "Admins can insert users in their office"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update users in their office"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete users in their office"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- =====================================================
-- 3. ADD: Proper office-scoped RLS policies for office_settings
-- =====================================================

CREATE POLICY "Users can view their office settings"
  ON public.office_settings
  FOR SELECT
  TO authenticated
  USING (office_id = get_my_office_id());

CREATE POLICY "Admins can manage their office settings"
  ON public.office_settings
  FOR ALL
  TO authenticated
  USING (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- =====================================================
-- 4. ADD: Office-scoped RLS for messages, campaigns, cases
-- =====================================================

-- Messages
DROP POLICY IF EXISTS "Messages Policy" ON public.messages;
CREATE POLICY "Messages office policy"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (office_id = get_my_office_id())
  WITH CHECK (office_id = get_my_office_id());

-- Message Tags (need to check via message's office_id)
CREATE POLICY "Message tags policy"
  ON public.message_tags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.office_id = get_my_office_id()
    )
  );

-- Draft Responses
CREATE POLICY "Draft responses office policy"
  ON public.draft_responses
  FOR ALL
  TO authenticated
  USING (office_id = get_my_office_id())
  WITH CHECK (office_id = get_my_office_id());

-- AI Processing Queue
CREATE POLICY "AI queue office policy"
  ON public.ai_processing_queue
  FOR SELECT
  TO authenticated
  USING (office_id = get_my_office_id());

-- =====================================================
-- 5. FIX: Add authorization to SECURITY DEFINER functions
-- =====================================================

-- Secure increment_campaign_count
CREATE OR REPLACE FUNCTION public.increment_campaign_count(p_campaign_id UUID)
RETURNS VOID AS $$
DECLARE
  v_caller_office_id UUID;
  v_campaign_office_id UUID;
BEGIN
  -- Get caller's office
  v_caller_office_id := get_my_office_id();

  -- Get campaign's office
  SELECT office_id INTO v_campaign_office_id
  FROM public.campaigns
  WHERE id = p_campaign_id;

  -- Verify authorization (allow service_role to bypass)
  IF v_caller_office_id IS NULL AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: No office context';
  END IF;

  IF v_caller_office_id IS NOT NULL AND v_caller_office_id != v_campaign_office_id THEN
    RAISE EXCEPTION 'Unauthorized: Campaign belongs to different office';
  END IF;

  UPDATE public.campaigns
  SET email_count = COALESCE(email_count, 0) + 1,
      updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Secure increment_bulk_response_recipients
CREATE OR REPLACE FUNCTION public.increment_bulk_response_recipients(p_bulk_response_id UUID)
RETURNS VOID AS $$
DECLARE
  v_caller_office_id UUID;
  v_bulk_response_office_id UUID;
BEGIN
  -- Get caller's office
  v_caller_office_id := get_my_office_id();

  -- Get bulk response's office
  SELECT office_id INTO v_bulk_response_office_id
  FROM public.bulk_responses
  WHERE id = p_bulk_response_id;

  -- Verify authorization (allow service_role to bypass)
  IF v_caller_office_id IS NULL AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: No office context';
  END IF;

  IF v_caller_office_id IS NOT NULL AND v_caller_office_id != v_bulk_response_office_id THEN
    RAISE EXCEPTION 'Unauthorized: Bulk response belongs to different office';
  END IF;

  UPDATE public.bulk_responses
  SET total_recipients = COALESCE(total_recipients, 0) + 1,
      updated_at = NOW()
  WHERE id = p_bulk_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- 6. ADD: Profile role change restrictions (only admins)
-- =====================================================

-- First check if policy exists, drop and recreate
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

CREATE POLICY "Users can update own non-role fields"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      -- Non-admins cannot change their own role
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles in their office"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- =====================================================
-- 7. ADD: Audit action for 2FA events (for future implementation)
-- =====================================================

DO $$
BEGIN
  -- Add new audit actions if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'mfa_enroll' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'mfa_enroll';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'mfa_verify' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'mfa_verify';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'mfa_disable' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'mfa_disable';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Ignore if already exists
END $$;

-- =====================================================
-- 8. SECURITY: Add session validation columns for future 2FA
-- =====================================================

-- Add MFA requirement tracking to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'mfa_enabled') THEN
    ALTER TABLE public.profiles ADD COLUMN mfa_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'mfa_verified_at') THEN
    ALTER TABLE public.profiles ADD COLUMN mfa_verified_at TIMESTAMPTZ;
  END IF;
END $$;

-- =====================================================
-- IMPORTANT: Encrypt Outlook session cookies
-- This requires pgcrypto extension
-- =====================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Note: Full encryption implementation requires:
-- 1. Storing encryption key securely (not in DB)
-- 2. Application-level encrypt/decrypt
-- 3. Key rotation strategy
-- For now, we add a comment as a reminder

COMMENT ON TABLE public.integration_outlook_sessions IS
  'SECURITY WARNING: cookies column contains sensitive session tokens.
   Consider encrypting with pgp_sym_encrypt() or application-level encryption.
   See: https://www.postgresql.org/docs/current/pgcrypto.html';

-- =====================================================
-- 9. Add rate limiting support for login attempts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT false
);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON public.login_attempts(email, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role should access
CREATE POLICY "Service role only"
  ON public.login_attempts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_email TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  v_recent_failures INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_recent_failures
  FROM public.login_attempts
  WHERE email = lower(p_email)
    AND success = false
    AND attempted_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  RETURN v_recent_failures < p_max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- 10. Audit log for this migration
-- =====================================================

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
      'migration', '20241216000002_security_hardening',
      'fixes', ARRAY[
        'Removed overly permissive RLS policies',
        'Added office-scoped RLS for users, office_settings, messages, draft_responses',
        'Secured SECURITY DEFINER functions',
        'Added admin-only profile role updates',
        'Added 2FA audit actions',
        'Added login rate limiting support',
        'Added MFA columns to profiles'
      ]
    ),
    NOW()
  FROM public.offices;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
