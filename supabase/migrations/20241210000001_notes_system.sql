-- Notes System Migration
-- Creates notes and note_replies tables for collaborative note-taking

-- ============================================================================
-- NOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- Polymorphic association - one of these should be set
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  thread_id UUID, -- For message thread notes

  -- Note content
  body TEXT NOT NULL,

  -- Audit fields
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure at least one association is set
  CONSTRAINT notes_must_have_context CHECK (
    (case_id IS NOT NULL)::int +
    (campaign_id IS NOT NULL)::int +
    (thread_id IS NOT NULL)::int >= 1
  )
);

-- Indexes for efficient lookups
CREATE INDEX idx_notes_office ON notes(office_id);
CREATE INDEX idx_notes_case ON notes(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_notes_campaign ON notes(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_notes_thread ON notes(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);

-- ============================================================================
-- NOTE REPLIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS note_replies (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,

  -- Reply content
  body TEXT NOT NULL,

  -- Audit fields
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_note_replies_note ON note_replies(note_id);
CREATE INDEX idx_note_replies_office ON note_replies(office_id);
CREATE INDEX idx_note_replies_created_at ON note_replies(created_at ASC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_replies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see notes from their office
CREATE POLICY "Users can view notes from their office" ON notes
  FOR SELECT USING (office_id = get_my_office_id());

CREATE POLICY "Users can insert notes for their office" ON notes
  FOR INSERT WITH CHECK (office_id = get_my_office_id());

CREATE POLICY "Users can update their own notes" ON notes
  FOR UPDATE USING (office_id = get_my_office_id() AND created_by = auth.uid());

CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE USING (office_id = get_my_office_id() AND created_by = auth.uid());

-- Policy: Users can only see replies from their office
CREATE POLICY "Users can view replies from their office" ON note_replies
  FOR SELECT USING (office_id = get_my_office_id());

CREATE POLICY "Users can insert replies for their office" ON note_replies
  FOR INSERT WITH CHECK (office_id = get_my_office_id());

CREATE POLICY "Users can update their own replies" ON note_replies
  FOR UPDATE USING (office_id = get_my_office_id() AND created_by = auth.uid());

CREATE POLICY "Users can delete their own replies" ON note_replies
  FOR DELETE USING (office_id = get_my_office_id() AND created_by = auth.uid());

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_note_replies_updated_at
  BEFORE UPDATE ON note_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
