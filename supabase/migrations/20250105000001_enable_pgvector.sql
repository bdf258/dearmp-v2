-- ============================================================================
-- Migration: Enable pgvector Extension
-- Enables vector similarity search for tag recommendations
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON EXTENSION vector IS 'Vector similarity search extension for tag embeddings';
