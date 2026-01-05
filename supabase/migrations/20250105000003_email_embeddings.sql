-- ============================================================================
-- Migration: Email Embeddings Cache Table
-- Caches email embeddings for faster repeated tag searches
-- ============================================================================

-- Create email embeddings cache table
CREATE TABLE IF NOT EXISTS public.email_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_email_embeddings_message_id ON public.email_embeddings(message_id);
CREATE INDEX IF NOT EXISTS idx_email_embeddings_office_id ON public.email_embeddings(office_id);

-- Enable RLS
ALTER TABLE public.email_embeddings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their office's embeddings
CREATE POLICY "Email embeddings office read policy"
  ON public.email_embeddings
  FOR SELECT
  TO authenticated
  USING (office_id = public.get_my_office_id());

-- Service role has full access
CREATE POLICY "Service role has full access to email_embeddings"
  ON public.email_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.email_embeddings IS
  'Caches email content embeddings for efficient tag similarity search';
