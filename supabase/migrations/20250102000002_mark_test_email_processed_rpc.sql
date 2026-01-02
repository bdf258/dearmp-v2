-- Migration: Add RPC function to mark test emails as processed
-- This is called by the triage worker when processing completes for test emails

CREATE OR REPLACE FUNCTION mark_test_email_processed(p_email_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, legacy
AS $$
BEGIN
  -- Update the actioned flag for the test email
  -- Only updates if is_test_email = true for safety
  UPDATE legacy.emails
  SET actioned = true
  WHERE id = p_email_id
    AND is_test_email = true;

  IF NOT FOUND THEN
    RAISE WARNING 'Test email not found or not a test email: %', p_email_id;
  END IF;
END;
$$;

-- Grant execute to service role (worker uses service role key)
GRANT EXECUTE ON FUNCTION mark_test_email_processed(UUID) TO service_role;
