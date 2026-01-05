-- ============================================================================
-- Migration: Add Tag Embeddings and Usage Hints
-- Adds embedding support to the legacy.tags table for vector similarity search
-- ============================================================================

-- Add embedding column (768 dimensions for Gemini text-embedding-004)
ALTER TABLE legacy.tags ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add user-editable usage hint for LLM context (max 150 chars)
-- This tells the LLM how/when to use this tag
ALTER TABLE legacy.tags ADD COLUMN IF NOT EXISTS usage_hint TEXT;
ALTER TABLE legacy.tags ADD CONSTRAINT tags_usage_hint_length
  CHECK (char_length(usage_hint) <= 150);

COMMENT ON COLUMN legacy.tags.usage_hint IS
  'User-editable description (max 150 chars) explaining when to apply this tag. Shown to LLM during triage.';

-- Add description column for more context
ALTER TABLE legacy.tags ADD COLUMN IF NOT EXISTS description TEXT;

-- Add auto_assign_keywords for keyword matching
ALTER TABLE legacy.tags ADD COLUMN IF NOT EXISTS auto_assign_keywords TEXT[];

-- Add metadata for embedding tracking
ALTER TABLE legacy.tags ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE legacy.tags ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Composite text field for generating embeddings
-- Uses CONCAT_WS to properly handle NULLs without extra spaces
ALTER TABLE legacy.tags ADD COLUMN IF NOT EXISTS search_text TEXT
  GENERATED ALWAYS AS (
    TRIM(CONCAT_WS(' ', tag, description, array_to_string(auto_assign_keywords, ' ')))
  ) STORED;

-- Create HNSW index for fast similarity search
-- HNSW works well with any dataset size (unlike IVFFlat which needs 1000+ vectors)
CREATE INDEX IF NOT EXISTS idx_legacy_tags_embedding ON legacy.tags
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON COLUMN legacy.tags.embedding IS
  'Vector embedding (768d) generated from search_text for similarity search';
COMMENT ON COLUMN legacy.tags.embedding_model IS
  'Model used to generate the embedding (e.g., text-embedding-004)';
COMMENT ON COLUMN legacy.tags.embedding_updated_at IS
  'Timestamp when the embedding was last generated';
COMMENT ON COLUMN legacy.tags.search_text IS
  'Composite text field used for embedding generation';
