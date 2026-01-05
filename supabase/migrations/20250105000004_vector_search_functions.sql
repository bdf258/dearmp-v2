-- ============================================================================
-- Migration: Vector Search Functions
-- Functions for searching tags by vector similarity and keyword fallback
-- ============================================================================

-- Vector similarity search function
CREATE OR REPLACE FUNCTION search_similar_tags(
  query_embedding vector(768),
  target_office_id UUID,
  match_count INTEGER DEFAULT 20,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  tag_id UUID,
  name TEXT,
  description TEXT,
  usage_hint TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.tag,
    t.description,
    t.usage_hint,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM legacy.tags t
  WHERE
    t.office_id = target_office_id
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_similar_tags IS
  'Search for semantically similar tags using vector cosine similarity';

-- Keyword-based fallback search function
-- Used when vector search fails or returns insufficient results
CREATE OR REPLACE FUNCTION search_tags_by_keywords(
  search_text TEXT,
  target_office_id UUID,
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  tag_id UUID,
  name TEXT,
  description TEXT,
  usage_hint TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_terms TEXT[];
BEGIN
  -- Split search text into words, filter short words
  search_terms := array(
    SELECT DISTINCT lower(term)
    FROM unnest(regexp_split_to_array(lower(search_text), '\s+')) AS term
    WHERE length(term) >= 3
    LIMIT 50  -- Limit terms for performance
  );

  -- Return empty if no valid terms
  IF array_length(search_terms, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.tag,
    t.description,
    t.usage_hint,
    -- Calculate relevance based on keyword matches
    (
      SELECT COUNT(*)::FLOAT / GREATEST(array_length(search_terms, 1), 1)
      FROM unnest(search_terms) term
      WHERE
        lower(t.tag) LIKE '%' || term || '%'
        OR lower(COALESCE(t.description, '')) LIKE '%' || term || '%'
        OR lower(COALESCE(t.usage_hint, '')) LIKE '%' || term || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(t.auto_assign_keywords) kw
          WHERE lower(kw) LIKE '%' || term || '%'
        )
    ) AS relevance
  FROM legacy.tags t
  WHERE t.office_id = target_office_id
  HAVING (
    SELECT COUNT(*)::FLOAT / GREATEST(array_length(search_terms, 1), 1)
    FROM unnest(search_terms) term
    WHERE
      lower(t.tag) LIKE '%' || term || '%'
      OR lower(COALESCE(t.description, '')) LIKE '%' || term || '%'
      OR lower(COALESCE(t.usage_hint, '')) LIKE '%' || term || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(t.auto_assign_keywords) kw
        WHERE lower(kw) LIKE '%' || term || '%'
      )
  ) > 0
  ORDER BY relevance DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_tags_by_keywords IS
  'Fallback keyword-based tag search when vector search is unavailable';

-- Get tag embedding stats for an office
CREATE OR REPLACE FUNCTION get_tag_embedding_stats(target_office_id UUID)
RETURNS TABLE (
  total_tags INTEGER,
  embedded_tags INTEGER,
  pending_tags INTEGER,
  percent_complete FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_embedded INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM legacy.tags
  WHERE office_id = target_office_id;

  SELECT COUNT(*) INTO v_embedded
  FROM legacy.tags
  WHERE office_id = target_office_id
    AND embedding IS NOT NULL;

  RETURN QUERY SELECT
    v_total,
    v_embedded,
    v_total - v_embedded,
    CASE WHEN v_total > 0 THEN (v_embedded::FLOAT / v_total * 100) ELSE 100.0 END;
END;
$$;

COMMENT ON FUNCTION get_tag_embedding_stats IS
  'Get embedding coverage statistics for tags in an office';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_similar_tags TO service_role;
GRANT EXECUTE ON FUNCTION search_tags_by_keywords TO service_role;
GRANT EXECUTE ON FUNCTION get_tag_embedding_stats TO authenticated, service_role;
