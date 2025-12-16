-- Security Fixes Migration
-- Fixes RLS policies and RPC vulnerabilities identified in security audit

-- =====================================================
-- 1. FIX: email_outbox_queue RLS policies (CRITICAL)
-- Issue: Any authenticated user could read/write ALL email queue entries
-- Fix: Restrict to user's own office via get_my_office_id()
-- =====================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.email_outbox_queue;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.email_outbox_queue;

-- Create proper office-scoped policies
CREATE POLICY "Users can view email queue for their office"
  ON public.email_outbox_queue
  FOR SELECT
  TO authenticated
  USING (office_id = get_my_office_id());

CREATE POLICY "Users can insert to email queue for their office"
  ON public.email_outbox_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (office_id = get_my_office_id());

CREATE POLICY "Users can update email queue for their office"
  ON public.email_outbox_queue
  FOR UPDATE
  TO authenticated
  USING (office_id = get_my_office_id());

-- Service role (workers) can access all - this is handled by bypassing RLS

-- =====================================================
-- 2. FIX: rejected_emails RLS policy (Cross-tenant leak)
-- Issue: ANY admin could view ALL rejected emails across offices
-- Fix: Add office context check (rejected_emails doesn't have office_id,
--      so we restrict to service_role only or validate via target_email)
-- =====================================================

DROP POLICY IF EXISTS "Admins can view rejected emails" ON public.rejected_emails;

-- Only service_role should access rejected emails (for admin dashboard, use a view)
CREATE POLICY "Service role can view rejected emails"
  ON public.rejected_emails
  FOR SELECT
  USING (auth.role() = 'service_role');

-- If admins need to see rejected emails, they should use an RPC that filters by their office's inbound email

-- =====================================================
-- 3. FIX: generate_campaign_outbox_messages RPC (IDOR vulnerability)
-- Issue: Function accepts p_office_id parameter without validating caller owns that office
-- Fix: Add authorization check at the start of the function
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_campaign_outbox_messages(p_bulk_response_id uuid, p_office_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign_id UUID;
  v_subject TEXT;
  v_body_template TEXT;
  v_count INTEGER := 0;
  v_caller_office_id UUID;
BEGIN
  -- SECURITY FIX: Validate the caller has access to this office
  v_caller_office_id := get_my_office_id();

  IF v_caller_office_id IS NULL THEN
    -- Allow service_role to bypass (for workers)
    IF auth.role() != 'service_role' THEN
      RETURN jsonb_build_object('error', 'Unauthorized: No office context', 'queued_count', 0);
    END IF;
  ELSIF v_caller_office_id != p_office_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Office mismatch', 'queued_count', 0);
  END IF;

  -- 1. Get Bulk Response Details
  SELECT campaign_id, subject, body_markdown
  INTO v_campaign_id, v_subject, v_body_template
  FROM public.bulk_responses
  WHERE id = p_bulk_response_id AND office_id = p_office_id;

  IF v_campaign_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Bulk response not found', 'queued_count', 0);
  END IF;

  -- 2. Insert into Outbox Queue by joining Campaign -> Messages -> Message Recipients -> Constituents -> Contacts
  INSERT INTO public.email_outbox_queue (
    office_id,
    to_email,
    subject,
    body_html,
    status,
    campaign_id,
    case_id
  )
  SELECT DISTINCT ON (c.id)
    p_office_id,
    cc.value as to_email,
    v_subject,
    REPLACE(
      REPLACE(
        REPLACE(v_body_template, '{{full_name}}', COALESCE(c.full_name, 'Constituent')),
        '{{constituent_name}}', COALESCE(c.full_name, 'Constituent')
      ),
      E'\n', '<br/>'
    ),
    'pending',
    v_campaign_id,
    NULL
  FROM public.messages m
  JOIN public.message_recipients mr ON m.id = mr.message_id AND mr.recipient_type = 'from'
  JOIN public.constituents c ON mr.constituent_id = c.id
  JOIN public.constituent_contacts cc ON c.id = cc.constituent_id
  WHERE
    m.campaign_id = v_campaign_id
    AND m.office_id = p_office_id
    AND m.direction = 'inbound'
    AND cc.type = 'email'
    AND cc.is_primary = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 3. Update Bulk Response Status
  UPDATE public.bulk_responses
  SET status = 'sending'
  WHERE id = p_bulk_response_id;

  RETURN jsonb_build_object('queued_count', v_count);
END;
$function$;

-- =====================================================
-- 4. FIX: process_bulk_response_approval RPC (IDOR vulnerability)
-- Issue: Similar to above - no authorization check on office access
-- Fix: Add authorization check
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_bulk_response_approval(p_bulk_response_id uuid, p_approver_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_campaign_id UUID;
  v_office_id UUID;
  v_subject TEXT;
  v_body_markdown TEXT;
  v_recipient RECORD;
  v_caller_office_id UUID;
BEGIN
  -- SECURITY FIX: Get the bulk response and validate office access
  SELECT campaign_id, office_id, subject, body_markdown
  INTO v_campaign_id, v_office_id, v_subject, v_body_markdown
  FROM bulk_responses
  WHERE id = p_bulk_response_id;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Bulk response not found';
  END IF;

  -- Validate caller has access to this office
  v_caller_office_id := get_my_office_id();

  IF v_caller_office_id IS NULL THEN
    IF auth.role() != 'service_role' THEN
      RAISE EXCEPTION 'Unauthorized: No office context';
    END IF;
  ELSIF v_caller_office_id != v_office_id THEN
    RAISE EXCEPTION 'Unauthorized: Office mismatch';
  END IF;

  -- 1. Update status to 'approved'
  UPDATE bulk_responses
  SET status = 'approved'
  WHERE id = p_bulk_response_id;

  -- 2. Find unique senders from the messages table for this campaign
  FOR v_recipient IN
    SELECT DISTINCT ON (mr.email_address)
      mr.email_address as from_email,
      mr.name as from_name
    FROM messages m
    JOIN message_recipients mr ON m.id = mr.message_id AND mr.recipient_type = 'from'
    WHERE m.campaign_id = v_campaign_id
    AND m.direction = 'inbound'
    AND m.office_id = v_office_id
  LOOP
    -- 3. Insert into email queue
    INSERT INTO email_outbox_queue (
      office_id,
      to_email,
      subject,
      body_html,
      campaign_id,
      status
    ) VALUES (
      v_office_id,
      v_recipient.from_email,
      v_subject,
      REPLACE(
        REPLACE(v_body_markdown, '{{constituent_name}}', COALESCE(v_recipient.from_name, 'Constituent')),
        E'\n', '<br/>'
      ),
      v_campaign_id,
      'pending'
    );
  END LOOP;

  -- 4. Update status to 'sending'
  UPDATE bulk_responses
  SET status = 'sending'
  WHERE id = p_bulk_response_id;

END;
$function$;

-- =====================================================
-- 5. ADD: browser_automation_lock RLS policy
-- Issue: No RLS policies on this table
-- Fix: Add basic policies (this is a system table)
-- =====================================================

-- Enable RLS if not already enabled
ALTER TABLE public.browser_automation_lock ENABLE ROW LEVEL SECURITY;

-- Only service_role should manage the lock
CREATE POLICY "Service role manages automation lock"
  ON public.browser_automation_lock
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view lock status for their office
CREATE POLICY "Users can view lock status"
  ON public.browser_automation_lock
  FOR SELECT
  TO authenticated
  USING (locked_by_office_id IS NULL OR locked_by_office_id = get_my_office_id());

-- =====================================================
-- 6. ADD: Audit log entry for security update
-- =====================================================

-- This is informational only - creates a record of when security fixes were applied
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
      'migration', '20241216000001_security_fixes',
      'fixes', ARRAY[
        'email_outbox_queue RLS',
        'rejected_emails RLS',
        'generate_campaign_outbox_messages IDOR',
        'process_bulk_response_approval IDOR',
        'browser_automation_lock RLS'
      ]
    ),
    NOW()
  FROM public.offices;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if audit_logs table structure differs
  NULL;
END $$;

-- =====================================================
-- VERIFICATION QUERIES (run these to verify the fixes)
-- =====================================================
-- Uncomment and run manually to verify:

-- Check email_outbox_queue policies:
-- SELECT * FROM pg_policies WHERE tablename = 'email_outbox_queue';

-- Check rejected_emails policies:
-- SELECT * FROM pg_policies WHERE tablename = 'rejected_emails';

-- Check browser_automation_lock policies:
-- SELECT * FROM pg_policies WHERE tablename = 'browser_automation_lock';

-- Verify RPC function definitions:
-- SELECT pg_get_functiondef('generate_campaign_outbox_messages'::regproc);
-- SELECT pg_get_functiondef('process_bulk_response_approval'::regproc);
