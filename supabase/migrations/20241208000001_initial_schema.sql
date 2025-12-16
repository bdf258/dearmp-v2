-- DearMP v2 Database Schema
-- Initial migration for email ingestion and AI classification

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text similarity matching

-- ============================================================================
-- OFFICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS offices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('casework', 'westminster')),
  mp_name TEXT,
  mp_email TEXT,
  signature_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- OFFICE SETTINGS (for AI assignment rules)
-- ============================================================================
CREATE TABLE IF NOT EXISTS office_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  -- Assignment settings
  default_casework_assignee UUID, -- Default user for casework emails
  default_policy_assignee UUID, -- Default user for policy emails
  auto_assign_enabled BOOLEAN DEFAULT true,
  round_robin_enabled BOOLEAN DEFAULT false, -- Distribute evenly among staff
  -- AI settings
  ai_classification_enabled BOOLEAN DEFAULT true,
  ai_draft_response_enabled BOOLEAN DEFAULT true,
  ai_tagging_enabled BOOLEAN DEFAULT true,
  -- Response templates
  policy_response_style TEXT DEFAULT 'formal', -- formal, friendly, brief
  casework_acknowledgment_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id)
);

-- ============================================================================
-- USERS (Office Staff)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'mp')),
  is_active BOOLEAN DEFAULT true,
  -- Assignment preferences
  can_handle_casework BOOLEAN DEFAULT true,
  can_handle_policy BOOLEAN DEFAULT true,
  max_active_cases INTEGER DEFAULT 50,
  specialties TEXT[] DEFAULT '{}', -- Tags/categories this user specializes in
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign keys for office_settings after users table exists
ALTER TABLE office_settings
  ADD CONSTRAINT fk_default_casework_assignee
  FOREIGN KEY (default_casework_assignee) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE office_settings
  ADD CONSTRAINT fk_default_policy_assignee
  FOREIGN KEY (default_policy_assignee) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- TAGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  description TEXT, -- For AI to understand what this tag means
  auto_assign_keywords TEXT[] DEFAULT '{}', -- Keywords that trigger this tag
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, name)
);

-- ============================================================================
-- CAMPAIGNS (for grouped policy emails)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  subject_pattern TEXT, -- Regex pattern to match subjects
  fingerprint_hash TEXT, -- Content hash for matching similar emails
  email_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_fingerprint ON campaigns(fingerprint_hash);
CREATE INDEX idx_campaigns_office ON campaigns(office_id);

-- ============================================================================
-- CASES (for casework tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'awaiting_response', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE(office_id, reference_number)
);

CREATE INDEX idx_cases_office ON cases(office_id);
CREATE INDEX idx_cases_assignee ON cases(assigned_to_user_id);

-- ============================================================================
-- MESSAGES (Emails)
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- Email metadata
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  snippet TEXT, -- First 200 chars of body
  body TEXT NOT NULL,
  body_html TEXT, -- Original HTML if available

  -- Email threading
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  thread_id UUID, -- Groups related messages
  in_reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Classification (AI-populated)
  is_triage_needed BOOLEAN DEFAULT true,
  is_policy_email BOOLEAN, -- NULL = not yet classified, true = policy, false = casework
  email_type TEXT CHECK (email_type IN ('policy', 'casework', 'campaign', 'spam', 'personal')),
  classification_confidence REAL, -- 0.0 to 1.0
  classification_reasoning TEXT, -- AI explanation

  -- Fingerprinting for campaign detection
  fingerprint_hash TEXT, -- Content hash for grouping similar emails
  is_campaign_email BOOLEAN DEFAULT false,

  -- Relationships
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- AI processing status
  ai_processed_at TIMESTAMPTZ,
  ai_error TEXT, -- Last error if AI processing failed

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_office ON messages(office_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_fingerprint ON messages(fingerprint_hash);
CREATE INDEX idx_messages_triage ON messages(office_id, is_triage_needed) WHERE is_triage_needed = true;
CREATE INDEX idx_messages_campaign ON messages(campaign_id);
CREATE INDEX idx_messages_case ON messages(case_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- ============================================================================
-- MESSAGE TAGS (Junction table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  added_by TEXT DEFAULT 'ai', -- 'ai' or 'user'
  confidence REAL, -- AI confidence for this tag
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, tag_id)
);

CREATE INDEX idx_message_tags_message ON message_tags(message_id);
CREATE INDEX idx_message_tags_tag ON message_tags(tag_id);

-- ============================================================================
-- DRAFT RESPONSES (AI-generated responses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS draft_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- Draft content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,

  -- Draft metadata
  draft_type TEXT NOT NULL CHECK (draft_type IN ('individual', 'bulk')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'edited', 'approved', 'sent', 'rejected')),

  -- For bulk responses
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  fingerprint_hash TEXT, -- Links to the message group this is for

  -- AI generation info
  generated_by TEXT DEFAULT 'gemini-flash-lite',
  generation_prompt TEXT, -- The prompt used to generate this

  -- User edits
  edited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,

  -- Approval tracking
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_draft_responses_message ON draft_responses(message_id);
CREATE INDEX idx_draft_responses_campaign ON draft_responses(campaign_id);
CREATE INDEX idx_draft_responses_fingerprint ON draft_responses(fingerprint_hash);
CREATE INDEX idx_draft_responses_status ON draft_responses(status);

-- ============================================================================
-- BULK RESPONSES (For campaign emails)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  fingerprint_hash TEXT NOT NULL,

  -- Response content
  subject TEXT NOT NULL,
  body_template TEXT NOT NULL, -- Supports {{constituent_name}}, {{mp_name}} etc.
  body_template_html TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'sending', 'sent', 'rejected')),

  -- Creation/editing
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  edited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Approval
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- Sending stats
  sent_at TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  total_recipients INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bulk_responses_fingerprint ON bulk_responses(fingerprint_hash);
CREATE INDEX idx_bulk_responses_campaign ON bulk_responses(campaign_id);
CREATE INDEX idx_bulk_responses_office ON bulk_responses(office_id);

-- ============================================================================
-- AI PROCESSING QUEUE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_processing_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0, -- Higher = process first
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_queue_status ON ai_processing_queue(status, priority DESC, created_at);
CREATE INDEX idx_ai_queue_message ON ai_processing_queue(message_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate a fingerprint hash from email content
CREATE OR REPLACE FUNCTION generate_email_fingerprint(subject TEXT, body TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized_text TEXT;
BEGIN
  -- Normalize: lowercase, remove punctuation, collapse whitespace
  normalized_text := lower(COALESCE(subject, '') || ' ' || COALESCE(body, ''));
  normalized_text := regexp_replace(normalized_text, '[^a-z0-9\s]', '', 'g');
  normalized_text := regexp_replace(normalized_text, '\s+', ' ', 'g');
  normalized_text := trim(normalized_text);

  -- Return MD5 hash
  RETURN md5(normalized_text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_offices_updated_at
  BEFORE UPDATE ON offices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_office_settings_updated_at
  BEFORE UPDATE ON office_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_draft_responses_updated_at
  BEFORE UPDATE ON draft_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bulk_responses_updated_at
  BEFORE UPDATE ON bulk_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_processing_queue ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be added based on authentication strategy
-- For now, we'll add permissive policies for development

-- Service role bypass for Edge Functions
CREATE POLICY "Service role has full access to offices" ON offices
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to office_settings" ON office_settings
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to users" ON users
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to tags" ON tags
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to campaigns" ON campaigns
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to cases" ON cases
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to messages" ON messages
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to message_tags" ON message_tags
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to draft_responses" ON draft_responses
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to bulk_responses" ON bulk_responses
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to ai_processing_queue" ON ai_processing_queue
  FOR ALL USING (true);

-- ============================================================================
-- TRIGGER FOR NEW MESSAGE -> AI PROCESSING
-- ============================================================================

-- Function to queue new messages for AI processing
CREATE OR REPLACE FUNCTION queue_message_for_ai_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue inbound messages that need triage
  IF NEW.direction = 'inbound' AND NEW.is_triage_needed = true THEN
    INSERT INTO ai_processing_queue (message_id, office_id, priority)
    VALUES (NEW.id, NEW.office_id, CASE
      WHEN NEW.subject ILIKE '%urgent%' THEN 10
      WHEN NEW.subject ILIKE '%asap%' THEN 8
      ELSE 0
    END);

    -- Call the edge function via pg_net or webhook
    -- This will be handled by a separate scheduled job or webhook
    PERFORM pg_notify('new_message', json_build_object(
      'message_id', NEW.id,
      'office_id', NEW.office_id
    )::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_queue_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION queue_message_for_ai_processing();
