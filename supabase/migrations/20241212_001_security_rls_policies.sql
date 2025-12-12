-- Security Fix: Proper Row Level Security Policies
-- This migration replaces the permissive development policies with production-ready policies
-- Date: 2024-12-12

-- ============================================================================
-- DROP EXISTING PERMISSIVE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Service role has full access to offices" ON offices;
DROP POLICY IF EXISTS "Service role has full access to office_settings" ON office_settings;
DROP POLICY IF EXISTS "Service role has full access to users" ON users;
DROP POLICY IF EXISTS "Service role has full access to tags" ON tags;
DROP POLICY IF EXISTS "Service role has full access to campaigns" ON campaigns;
DROP POLICY IF EXISTS "Service role has full access to cases" ON cases;
DROP POLICY IF EXISTS "Service role has full access to messages" ON messages;
DROP POLICY IF EXISTS "Service role has full access to message_tags" ON message_tags;
DROP POLICY IF EXISTS "Service role has full access to draft_responses" ON draft_responses;
DROP POLICY IF EXISTS "Service role has full access to bulk_responses" ON bulk_responses;
DROP POLICY IF EXISTS "Service role has full access to ai_processing_queue" ON ai_processing_queue;

-- ============================================================================
-- HELPER FUNCTION: Get user's office_id from their profile
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.get_user_office_id()
RETURNS UUID AS $$
DECLARE
  office UUID;
BEGIN
  SELECT office_id INTO office
  FROM profiles
  WHERE id = auth.uid();
  RETURN office;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- HELPER FUNCTION: Check if user is admin in their office
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.is_office_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can read profiles in their office
CREATE POLICY "profiles_select_office"
  ON profiles FOR SELECT
  USING (office_id = auth.get_user_office_id());

-- Users can update only their own profile (except role)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Only admins can update other profiles' roles
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (
    auth.is_office_admin() AND
    office_id = auth.get_user_office_id()
  )
  WITH CHECK (
    office_id = auth.get_user_office_id()
  );

-- ============================================================================
-- OFFICES TABLE POLICIES
-- ============================================================================

-- Users can read their own office
CREATE POLICY "offices_select_own"
  ON offices FOR SELECT
  USING (id = auth.get_user_office_id());

-- Only admins can update their office
CREATE POLICY "offices_update_admin"
  ON offices FOR UPDATE
  USING (
    id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- OFFICE_SETTINGS TABLE POLICIES
-- ============================================================================

-- Users can read their office settings
CREATE POLICY "office_settings_select"
  ON office_settings FOR SELECT
  USING (office_id = auth.get_user_office_id());

-- Only admins can modify office settings
CREATE POLICY "office_settings_all_admin"
  ON office_settings FOR ALL
  USING (
    office_id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- USERS TABLE POLICIES (Office Staff Directory)
-- ============================================================================

-- Users can read staff in their office
CREATE POLICY "users_select_office"
  ON users FOR SELECT
  USING (office_id = auth.get_user_office_id());

-- Only admins can manage staff
CREATE POLICY "users_all_admin"
  ON users FOR ALL
  USING (
    office_id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- CONSTITUENTS TABLE POLICIES
-- ============================================================================

-- Users can read constituents in their office
CREATE POLICY "constituents_select"
  ON constituents FOR SELECT
  USING (office_id = auth.get_user_office_id());

-- Users can create constituents in their office
CREATE POLICY "constituents_insert"
  ON constituents FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

-- Users can update constituents in their office
CREATE POLICY "constituents_update"
  ON constituents FOR UPDATE
  USING (office_id = auth.get_user_office_id())
  WITH CHECK (office_id = auth.get_user_office_id());

-- Only admins can delete constituents
CREATE POLICY "constituents_delete_admin"
  ON constituents FOR DELETE
  USING (
    office_id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- CONSTITUENT_CONTACTS TABLE POLICIES
-- ============================================================================

-- Access controlled via constituent's office
CREATE POLICY "constituent_contacts_select"
  ON constituent_contacts FOR SELECT
  USING (
    constituent_id IN (
      SELECT id FROM constituents WHERE office_id = auth.get_user_office_id()
    )
  );

CREATE POLICY "constituent_contacts_insert"
  ON constituent_contacts FOR INSERT
  WITH CHECK (
    constituent_id IN (
      SELECT id FROM constituents WHERE office_id = auth.get_user_office_id()
    )
  );

CREATE POLICY "constituent_contacts_update"
  ON constituent_contacts FOR UPDATE
  USING (
    constituent_id IN (
      SELECT id FROM constituents WHERE office_id = auth.get_user_office_id()
    )
  );

CREATE POLICY "constituent_contacts_delete"
  ON constituent_contacts FOR DELETE
  USING (
    constituent_id IN (
      SELECT id FROM constituents WHERE office_id = auth.get_user_office_id()
    )
  );

-- ============================================================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================================================

CREATE POLICY "organizations_select"
  ON organizations FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "organizations_insert"
  ON organizations FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

CREATE POLICY "organizations_update"
  ON organizations FOR UPDATE
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "organizations_delete_admin"
  ON organizations FOR DELETE
  USING (
    office_id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- TAGS TABLE POLICIES
-- ============================================================================

CREATE POLICY "tags_select"
  ON tags FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "tags_insert"
  ON tags FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

CREATE POLICY "tags_update"
  ON tags FOR UPDATE
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "tags_delete"
  ON tags FOR DELETE
  USING (office_id = auth.get_user_office_id());

-- ============================================================================
-- CAMPAIGNS TABLE POLICIES
-- ============================================================================

CREATE POLICY "campaigns_select"
  ON campaigns FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "campaigns_insert"
  ON campaigns FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

CREATE POLICY "campaigns_update"
  ON campaigns FOR UPDATE
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "campaigns_delete_admin"
  ON campaigns FOR DELETE
  USING (
    office_id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- CASES TABLE POLICIES
-- ============================================================================

CREATE POLICY "cases_select"
  ON cases FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "cases_insert"
  ON cases FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

CREATE POLICY "cases_update"
  ON cases FOR UPDATE
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "cases_delete_admin"
  ON cases FOR DELETE
  USING (
    office_id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- CASE_PARTIES TABLE POLICIES
-- ============================================================================

CREATE POLICY "case_parties_select"
  ON case_parties FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "case_parties_insert"
  ON case_parties FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

CREATE POLICY "case_parties_update"
  ON case_parties FOR UPDATE
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "case_parties_delete"
  ON case_parties FOR DELETE
  USING (office_id = auth.get_user_office_id());

-- ============================================================================
-- MESSAGES TABLE POLICIES
-- ============================================================================

CREATE POLICY "messages_select"
  ON messages FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "messages_insert"
  ON messages FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

CREATE POLICY "messages_update"
  ON messages FOR UPDATE
  USING (office_id = auth.get_user_office_id());

-- Messages should generally not be deleted, only archived
CREATE POLICY "messages_delete_admin"
  ON messages FOR DELETE
  USING (
    office_id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- MESSAGE_TAGS TABLE POLICIES
-- ============================================================================

CREATE POLICY "message_tags_select"
  ON message_tags FOR SELECT
  USING (
    message_id IN (
      SELECT id FROM messages WHERE office_id = auth.get_user_office_id()
    )
  );

CREATE POLICY "message_tags_insert"
  ON message_tags FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT id FROM messages WHERE office_id = auth.get_user_office_id()
    )
  );

CREATE POLICY "message_tags_delete"
  ON message_tags FOR DELETE
  USING (
    message_id IN (
      SELECT id FROM messages WHERE office_id = auth.get_user_office_id()
    )
  );

-- ============================================================================
-- MESSAGE_RECIPIENTS TABLE POLICIES
-- ============================================================================

CREATE POLICY "message_recipients_select"
  ON message_recipients FOR SELECT
  USING (
    message_id IN (
      SELECT id FROM messages WHERE office_id = auth.get_user_office_id()
    )
  );

CREATE POLICY "message_recipients_insert"
  ON message_recipients FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT id FROM messages WHERE office_id = auth.get_user_office_id()
    )
  );

-- ============================================================================
-- DRAFT_RESPONSES TABLE POLICIES
-- ============================================================================

CREATE POLICY "draft_responses_select"
  ON draft_responses FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "draft_responses_insert"
  ON draft_responses FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

CREATE POLICY "draft_responses_update"
  ON draft_responses FOR UPDATE
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "draft_responses_delete"
  ON draft_responses FOR DELETE
  USING (office_id = auth.get_user_office_id());

-- ============================================================================
-- BULK_RESPONSES TABLE POLICIES
-- ============================================================================

CREATE POLICY "bulk_responses_select"
  ON bulk_responses FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "bulk_responses_insert"
  ON bulk_responses FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

CREATE POLICY "bulk_responses_update"
  ON bulk_responses FOR UPDATE
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "bulk_responses_delete"
  ON bulk_responses FOR DELETE
  USING (office_id = auth.get_user_office_id());

-- ============================================================================
-- AI_PROCESSING_QUEUE TABLE POLICIES
-- ============================================================================

CREATE POLICY "ai_processing_queue_select"
  ON ai_processing_queue FOR SELECT
  USING (office_id = auth.get_user_office_id());

-- Insert restricted to system (service role only via edge functions)
-- No user insert policy - handled by triggers

-- ============================================================================
-- EMAIL_OUTBOX_QUEUE TABLE POLICIES
-- ============================================================================

CREATE POLICY "email_outbox_queue_select"
  ON email_outbox_queue FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "email_outbox_queue_insert"
  ON email_outbox_queue FOR INSERT
  WITH CHECK (office_id = auth.get_user_office_id());

-- ============================================================================
-- INTEGRATION_OUTLOOK_SESSIONS TABLE POLICIES
-- ============================================================================

CREATE POLICY "integration_outlook_sessions_select"
  ON integration_outlook_sessions FOR SELECT
  USING (office_id = auth.get_user_office_id());

CREATE POLICY "integration_outlook_sessions_delete"
  ON integration_outlook_sessions FOR DELETE
  USING (office_id = auth.get_user_office_id());

-- Only admins can manage integrations
CREATE POLICY "integration_outlook_sessions_admin"
  ON integration_outlook_sessions FOR ALL
  USING (
    office_id = auth.get_user_office_id() AND
    auth.is_office_admin()
  );

-- ============================================================================
-- GRANT EXECUTE ON HELPER FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION auth.get_user_office_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_office_admin() TO authenticated;
