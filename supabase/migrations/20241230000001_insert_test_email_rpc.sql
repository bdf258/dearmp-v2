-- ============================================================================
-- INSERT TEST EMAIL RPC FUNCTION
-- Allows inserting test emails into legacy.emails via RPC since the legacy
-- schema is not exposed via the REST API
-- ============================================================================

-- Function to insert a test email
-- NOTE: This function accepts office_id as a parameter because the server
-- uses the service role key (not user JWT), so auth.uid() returns NULL.
-- The server validates user access to the office before calling this function.
CREATE OR REPLACE FUNCTION insert_legacy_test_email(
  p_office_id UUID,
  p_external_id INTEGER,
  p_subject TEXT,
  p_html_body TEXT,
  p_from_address TEXT,
  p_to_addresses JSONB,
  p_cc_addresses JSONB DEFAULT NULL,
  p_bcc_addresses JSONB DEFAULT NULL,
  p_received_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  office_id UUID,
  external_id INTEGER,
  subject TEXT,
  html_body TEXT,
  from_address TEXT,
  to_addresses JSONB,
  cc_addresses JSONB,
  bcc_addresses JSONB,
  type TEXT,
  actioned BOOLEAN,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  is_test_email BOOLEAN
) AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Validate office_id is provided
  IF p_office_id IS NULL THEN
    RAISE EXCEPTION 'Office ID is required';
  END IF;

  -- Insert the test email
  INSERT INTO legacy.emails (
    office_id,
    external_id,
    subject,
    html_body,
    from_address,
    to_addresses,
    cc_addresses,
    bcc_addresses,
    type,
    actioned,
    received_at,
    is_test_email,
    last_synced_at
  ) VALUES (
    p_office_id,
    p_external_id,
    p_subject,
    p_html_body,
    p_from_address,
    p_to_addresses,
    p_cc_addresses,
    p_bcc_addresses,
    'received',
    false,
    p_received_at,
    true,
    NOW()
  )
  RETURNING legacy.emails.id INTO v_id;

  -- Return the inserted row
  RETURN QUERY
  SELECT
    e.id,
    e.office_id,
    e.external_id,
    e.subject,
    e.html_body,
    e.from_address,
    e.to_addresses,
    e.cc_addresses,
    e.bcc_addresses,
    e.type,
    e.actioned,
    e.received_at,
    e.created_at,
    e.is_test_email
  FROM legacy.emails e
  WHERE e.id = v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list test emails for the specified office
-- NOTE: Accepts office_id as parameter since server uses service role key
CREATE OR REPLACE FUNCTION get_legacy_test_emails(
  p_office_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  office_id UUID,
  external_id INTEGER,
  subject TEXT,
  from_address TEXT,
  actioned BOOLEAN,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.office_id,
    e.external_id,
    e.subject,
    e.from_address,
    e.actioned,
    e.received_at,
    e.created_at
  FROM legacy.emails e
  WHERE e.office_id = p_office_id
    AND e.is_test_email = true
  ORDER BY e.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a test email
-- NOTE: Accepts office_id as parameter since server uses service role key
CREATE OR REPLACE FUNCTION delete_legacy_test_email(
  p_office_id UUID,
  p_email_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  deleted_id UUID,
  error TEXT
) AS $$
DECLARE
  v_is_test BOOLEAN;
BEGIN
  -- Check if email exists and is a test email
  SELECT e.is_test_email INTO v_is_test
  FROM legacy.emails e
  WHERE e.id = p_email_id AND e.office_id = p_office_id;

  IF v_is_test IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Email not found';
    RETURN;
  END IF;

  IF NOT v_is_test THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Cannot delete non-test emails through this endpoint';
    RETURN;
  END IF;

  -- Delete the email
  DELETE FROM legacy.emails WHERE id = p_email_id AND office_id = p_office_id;

  RETURN QUERY SELECT true, p_email_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_legacy_email_details to accept office_id as first parameter
-- This is a re-definition that replaces the original function signature
-- NOTE: Accepts office_id as parameter since server uses service role key
CREATE OR REPLACE FUNCTION get_legacy_email_details(
  p_office_id UUID,
  p_email_id UUID
)
RETURNS TABLE (
  id UUID,
  office_id UUID,
  external_id INTEGER,
  subject TEXT,
  html_body TEXT,
  from_address TEXT,
  to_addresses JSONB,
  cc_addresses JSONB,
  bcc_addresses JSONB,
  type TEXT,
  actioned BOOLEAN,
  received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  case_id UUID,
  case_external_id INTEGER,
  case_summary TEXT,
  case_status TEXT,
  case_type TEXT,
  constituent_id UUID,
  constituent_external_id INTEGER,
  constituent_first_name TEXT,
  constituent_last_name TEXT,
  constituent_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.office_id,
    e.external_id,
    e.subject,
    e.html_body,
    e.from_address,
    e.to_addresses,
    e.cc_addresses,
    e.bcc_addresses,
    e.type,
    e.actioned,
    e.received_at,
    e.sent_at,
    e.created_at,
    e.case_id,
    e.case_external_id,
    cs.summary as case_summary,
    st.name as case_status,
    ct.name as case_type,
    e.constituent_id,
    e.constituent_external_id,
    con.first_name as constituent_first_name,
    con.last_name as constituent_last_name,
    con.title as constituent_title
  FROM legacy.emails e
  LEFT JOIN legacy.cases cs ON e.case_id = cs.id
  LEFT JOIN legacy.status_types st ON cs.status_id = st.id
  LEFT JOIN legacy.case_types ct ON cs.case_type_id = ct.id
  LEFT JOIN legacy.constituents con ON e.constituent_id = con.id
  WHERE e.id = p_email_id
    AND e.office_id = p_office_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION insert_legacy_test_email TO authenticated;
GRANT EXECUTE ON FUNCTION get_legacy_test_emails TO authenticated;
GRANT EXECUTE ON FUNCTION delete_legacy_test_email TO authenticated;
GRANT EXECUTE ON FUNCTION get_legacy_email_details(UUID, UUID) TO authenticated;

-- Comments
COMMENT ON FUNCTION insert_legacy_test_email IS 'Insert a test email into the legacy.emails table for testing the triage pipeline';
COMMENT ON FUNCTION get_legacy_test_emails IS 'List test emails for the specified office';
COMMENT ON FUNCTION delete_legacy_test_email IS 'Delete a test email (only works for emails with is_test_email=true)';
COMMENT ON FUNCTION get_legacy_email_details(UUID, UUID) IS 'Get full details for a specific email including related case and constituent (server version with explicit office_id)';
