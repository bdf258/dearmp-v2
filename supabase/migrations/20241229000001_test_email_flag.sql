-- ============================================================================
-- TEST EMAIL FLAG MIGRATION
-- Adds is_test_email flag to legacy.emails table for testing triage pipeline
-- ============================================================================

-- Add is_test_email column to legacy.emails table
ALTER TABLE legacy.emails
ADD COLUMN IF NOT EXISTS is_test_email BOOLEAN DEFAULT FALSE;

-- Add index for filtering test emails
CREATE INDEX IF NOT EXISTS idx_legacy_emails_is_test
ON legacy.emails(office_id, is_test_email)
WHERE is_test_email = TRUE;

-- Comment
COMMENT ON COLUMN legacy.emails.is_test_email IS 'Flag to identify test emails uploaded via the test triage page';
