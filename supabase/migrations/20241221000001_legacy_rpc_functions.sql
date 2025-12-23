-- ============================================================================
-- LEGACY INTEGRATION RPC FUNCTIONS
-- Supabase RPC functions for frontend integration with legacy shadow data
-- ============================================================================

-- ============================================================================
-- TRIAGE QUEUE FUNCTIONS
-- ============================================================================

-- Get triage queue (unactioned emails from legacy.emails)
CREATE OR REPLACE FUNCTION get_legacy_triage_queue(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'received_at',
  p_order_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE (
  id UUID,
  office_id UUID,
  external_id INTEGER,
  subject TEXT,
  snippet TEXT,
  from_address TEXT,
  to_addresses JSONB,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  actioned BOOLEAN,
  case_id UUID,
  case_external_id INTEGER,
  constituent_id UUID,
  constituent_external_id INTEGER,
  constituent_name TEXT,
  total_count BIGINT
) AS $$
DECLARE
  v_office_id UUID;
  v_total BIGINT;
BEGIN
  -- Get the user's office
  v_office_id := public.get_my_office_id();

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM legacy.emails e
  WHERE e.office_id = v_office_id
    AND e.actioned = false
    AND e.type = 'received';

  -- Return results with proper ordering
  RETURN QUERY
  SELECT
    e.id,
    e.office_id,
    e.external_id,
    e.subject,
    LEFT(e.html_body, 200) as snippet,
    e.from_address,
    e.to_addresses,
    e.received_at,
    e.created_at,
    e.actioned,
    e.case_id,
    e.case_external_id,
    e.constituent_id,
    e.constituent_external_id,
    CONCAT_WS(' ', c.first_name, c.last_name) as constituent_name,
    v_total as total_count
  FROM legacy.emails e
  LEFT JOIN legacy.constituents c ON e.constituent_id = c.id
  WHERE e.office_id = v_office_id
    AND e.actioned = false
    AND e.type = 'received'
  ORDER BY
    CASE
      WHEN p_order_by = 'received_at' AND p_order_dir = 'desc' THEN e.received_at
    END DESC,
    CASE
      WHEN p_order_by = 'received_at' AND p_order_dir = 'asc' THEN e.received_at
    END ASC,
    CASE
      WHEN p_order_by = 'created_at' AND p_order_dir = 'desc' THEN e.created_at
    END DESC,
    CASE
      WHEN p_order_by = 'created_at' AND p_order_dir = 'asc' THEN e.created_at
    END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get details for a specific email
CREATE OR REPLACE FUNCTION get_legacy_email_details(
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
DECLARE
  v_office_id UUID;
BEGIN
  v_office_id := public.get_my_office_id();

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
    AND e.office_id = v_office_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confirm triage (mark emails as actioned, optionally link to case)
CREATE OR REPLACE FUNCTION confirm_legacy_triage(
  p_email_ids UUID[],
  p_case_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  confirmed_count INTEGER,
  case_id UUID,
  error TEXT
) AS $$
DECLARE
  v_office_id UUID;
  v_count INTEGER;
BEGIN
  v_office_id := public.get_my_office_id();

  -- Update emails to mark as actioned
  UPDATE legacy.emails
  SET
    actioned = true,
    case_id = COALESCE(p_case_id, legacy.emails.case_id),
    updated_at = NOW()
  WHERE id = ANY(p_email_ids)
    AND office_id = v_office_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the audit entry
  INSERT INTO legacy.sync_audit_log (
    office_id,
    entity_type,
    operation,
    new_data
  ) VALUES (
    v_office_id,
    'email_triage',
    'update',
    jsonb_build_object(
      'email_ids', p_email_ids,
      'case_id', p_case_id,
      'notes', p_notes,
      'confirmed_by', auth.uid()
    )
  );

  RETURN QUERY SELECT true, v_count, p_case_id, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, 0, NULL::UUID, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dismiss triage (mark emails as actioned without linking to case)
CREATE OR REPLACE FUNCTION dismiss_legacy_triage(
  p_email_ids UUID[],
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  dismissed_count INTEGER,
  error TEXT
) AS $$
DECLARE
  v_office_id UUID;
  v_count INTEGER;
BEGIN
  v_office_id := public.get_my_office_id();

  -- Update emails to mark as actioned
  UPDATE legacy.emails
  SET
    actioned = true,
    updated_at = NOW()
  WHERE id = ANY(p_email_ids)
    AND office_id = v_office_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the audit entry
  INSERT INTO legacy.sync_audit_log (
    office_id,
    entity_type,
    operation,
    new_data
  ) VALUES (
    v_office_id,
    'email_triage',
    'delete',
    jsonb_build_object(
      'email_ids', p_email_ids,
      'reason', p_reason,
      'dismissed_by', auth.uid()
    )
  );

  RETURN QUERY SELECT true, v_count, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, 0, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get triage statistics
CREATE OR REPLACE FUNCTION get_legacy_triage_stats()
RETURNS TABLE (
  pending_count BIGINT,
  actioned_today_count BIGINT,
  total_this_week BIGINT,
  actioned_this_week BIGINT
) AS $$
DECLARE
  v_office_id UUID;
  v_today TIMESTAMPTZ;
  v_week_ago TIMESTAMPTZ;
BEGIN
  v_office_id := public.get_my_office_id();
  v_today := DATE_TRUNC('day', NOW());
  v_week_ago := NOW() - INTERVAL '7 days';

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM legacy.emails WHERE office_id = v_office_id AND actioned = false AND type = 'received'),
    (SELECT COUNT(*) FROM legacy.emails WHERE office_id = v_office_id AND actioned = true AND type = 'received' AND updated_at >= v_today),
    (SELECT COUNT(*) FROM legacy.emails WHERE office_id = v_office_id AND type = 'received' AND received_at >= v_week_ago),
    (SELECT COUNT(*) FROM legacy.emails WHERE office_id = v_office_id AND actioned = true AND type = 'received' AND received_at >= v_week_ago);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SYNC STATUS FUNCTIONS
-- ============================================================================

-- Get sync status for all entity types
CREATE OR REPLACE FUNCTION get_legacy_sync_status()
RETURNS TABLE (
  entity_type TEXT,
  last_sync_started_at TIMESTAMPTZ,
  last_sync_completed_at TIMESTAMPTZ,
  last_sync_success BOOLEAN,
  last_sync_error TEXT,
  records_synced INTEGER,
  records_failed INTEGER,
  updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_office_id UUID;
BEGIN
  v_office_id := public.get_my_office_id();

  RETURN QUERY
  SELECT
    s.entity_type,
    s.last_sync_started_at,
    s.last_sync_completed_at,
    s.last_sync_success,
    s.last_sync_error,
    s.records_synced,
    s.records_failed,
    s.updated_at
  FROM legacy.sync_status s
  WHERE s.office_id = v_office_id
  ORDER BY s.entity_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REFERENCE DATA FUNCTIONS
-- ============================================================================

-- Get all reference data in one call
CREATE OR REPLACE FUNCTION get_legacy_reference_data(
  p_active_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
  case_types JSONB,
  status_types JSONB,
  category_types JSONB,
  contact_types JSONB,
  caseworkers JSONB,
  tags JSONB,
  flags JSONB
) AS $$
DECLARE
  v_office_id UUID;
BEGIN
  v_office_id := public.get_my_office_id();

  RETURN QUERY
  SELECT
    -- Case Types
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', ct.id,
        'externalId', ct.external_id,
        'name', ct.name,
        'isActive', ct.is_active
      ) ORDER BY ct.name)
      FROM legacy.case_types ct
      WHERE ct.office_id = v_office_id
        AND (NOT p_active_only OR ct.is_active = true)),
      '[]'::jsonb
    ),
    -- Status Types
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', st.id,
        'externalId', st.external_id,
        'name', st.name,
        'isActive', st.is_active
      ) ORDER BY st.name)
      FROM legacy.status_types st
      WHERE st.office_id = v_office_id
        AND (NOT p_active_only OR st.is_active = true)),
      '[]'::jsonb
    ),
    -- Category Types
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', cat.id,
        'externalId', cat.external_id,
        'name', cat.name,
        'isActive', cat.is_active
      ) ORDER BY cat.name)
      FROM legacy.category_types cat
      WHERE cat.office_id = v_office_id
        AND (NOT p_active_only OR cat.is_active = true)),
      '[]'::jsonb
    ),
    -- Contact Types
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', cont.id,
        'externalId', cont.external_id,
        'name', cont.name,
        'type', cont.type,
        'isActive', cont.is_active
      ) ORDER BY cont.name)
      FROM legacy.contact_types cont
      WHERE cont.office_id = v_office_id
        AND (NOT p_active_only OR cont.is_active = true)),
      '[]'::jsonb
    ),
    -- Caseworkers
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', cw.id,
        'externalId', cw.external_id,
        'name', cw.name,
        'email', cw.email,
        'isActive', cw.is_active
      ) ORDER BY cw.name)
      FROM legacy.caseworkers cw
      WHERE cw.office_id = v_office_id
        AND (NOT p_active_only OR cw.is_active = true)),
      '[]'::jsonb
    ),
    -- Tags
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'externalId', t.external_id,
        'name', t.tag
      ) ORDER BY t.tag)
      FROM legacy.tags t
      WHERE t.office_id = v_office_id),
      '[]'::jsonb
    ),
    -- Flags
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', f.id,
        'externalId', f.external_id,
        'name', f.flag
      ) ORDER BY f.flag)
      FROM legacy.flags f
      WHERE f.office_id = v_office_id),
      '[]'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CONSTITUENT SEARCH
-- ============================================================================

-- Search constituents by name or email
CREATE OR REPLACE FUNCTION search_legacy_constituents(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  external_id INTEGER,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  email TEXT,
  case_count BIGINT
) AS $$
DECLARE
  v_office_id UUID;
BEGIN
  v_office_id := public.get_my_office_id();

  RETURN QUERY
  SELECT
    c.id,
    c.external_id,
    c.first_name,
    c.last_name,
    c.title,
    cd.value as email,
    (SELECT COUNT(*) FROM legacy.cases cs WHERE cs.constituent_id = c.id) as case_count
  FROM legacy.constituents c
  LEFT JOIN legacy.contact_details cd ON cd.constituent_id = c.id AND cd.contact_type_external_id = 1
  WHERE c.office_id = v_office_id
    AND (
      c.first_name ILIKE '%' || p_query || '%'
      OR c.last_name ILIKE '%' || p_query || '%'
      OR cd.value ILIKE '%' || p_query || '%'
    )
  ORDER BY c.last_name, c.first_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CASE SEARCH
-- ============================================================================

-- Search cases
CREATE OR REPLACE FUNCTION search_legacy_cases(
  p_query TEXT DEFAULT NULL,
  p_constituent_id UUID DEFAULT NULL,
  p_status_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  external_id INTEGER,
  summary TEXT,
  status_name TEXT,
  case_type_name TEXT,
  constituent_name TEXT,
  assigned_to_name TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_office_id UUID;
  v_total BIGINT;
BEGIN
  v_office_id := public.get_my_office_id();

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM legacy.cases c
  WHERE c.office_id = v_office_id
    AND (p_query IS NULL OR c.summary ILIKE '%' || p_query || '%')
    AND (p_constituent_id IS NULL OR c.constituent_id = p_constituent_id)
    AND (p_status_ids IS NULL OR c.status_id = ANY(p_status_ids));

  RETURN QUERY
  SELECT
    c.id,
    c.external_id,
    c.summary,
    st.name as status_name,
    ct.name as case_type_name,
    CONCAT_WS(' ', con.first_name, con.last_name) as constituent_name,
    cw.name as assigned_to_name,
    c.created_at,
    v_total as total_count
  FROM legacy.cases c
  LEFT JOIN legacy.status_types st ON c.status_id = st.id
  LEFT JOIN legacy.case_types ct ON c.case_type_id = ct.id
  LEFT JOIN legacy.constituents con ON c.constituent_id = con.id
  LEFT JOIN legacy.caseworkers cw ON c.assigned_to_id = cw.id
  WHERE c.office_id = v_office_id
    AND (p_query IS NULL OR c.summary ILIKE '%' || p_query || '%')
    AND (p_constituent_id IS NULL OR c.constituent_id = p_constituent_id)
    AND (p_status_ids IS NULL OR c.status_id = ANY(p_status_ids))
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_legacy_triage_queue TO authenticated;
GRANT EXECUTE ON FUNCTION get_legacy_email_details TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_legacy_triage TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_legacy_triage TO authenticated;
GRANT EXECUTE ON FUNCTION get_legacy_triage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_legacy_sync_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_legacy_reference_data TO authenticated;
GRANT EXECUTE ON FUNCTION search_legacy_constituents TO authenticated;
GRANT EXECUTE ON FUNCTION search_legacy_cases TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_legacy_triage_queue IS 'Get paginated list of unactioned emails for triage from legacy shadow database';
COMMENT ON FUNCTION get_legacy_email_details IS 'Get full details for a specific email including related case and constituent';
COMMENT ON FUNCTION confirm_legacy_triage IS 'Confirm triage by marking emails as actioned, optionally linking to a case';
COMMENT ON FUNCTION dismiss_legacy_triage IS 'Dismiss emails from triage queue without linking to a case';
COMMENT ON FUNCTION get_legacy_triage_stats IS 'Get statistics about the triage queue';
COMMENT ON FUNCTION get_legacy_sync_status IS 'Get sync status for all entity types for the current office';
COMMENT ON FUNCTION get_legacy_reference_data IS 'Get all reference data (case types, statuses, etc.) in one call';
COMMENT ON FUNCTION search_legacy_constituents IS 'Search constituents by name or email';
COMMENT ON FUNCTION search_legacy_cases IS 'Search cases with optional filters';
