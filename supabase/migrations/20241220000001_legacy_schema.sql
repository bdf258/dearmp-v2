-- ============================================================================
-- LEGACY SCHEMA MIGRATION (Multi-Tenant)
-- Creates parallel shadow tables for legacy Caseworker system integration
-- This implements the Anti-Corruption Layer (ACL) pattern
--
-- IMPORTANT: All tables are office-scoped for multi-tenancy isolation
-- ============================================================================

-- Create a separate schema for legacy data to keep it isolated
CREATE SCHEMA IF NOT EXISTS legacy;

-- ============================================================================
-- LEGACY REFERENCE DATA TABLES
-- These mirror the reference/lookup tables from the legacy system
-- Reference data is per-office as different offices may have different
-- configurations in their legacy instances
-- ============================================================================

-- Status Types (case statuses)
CREATE TABLE IF NOT EXISTS legacy.status_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL, -- Legacy system ID
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id) -- External IDs are unique per office
);

CREATE INDEX idx_legacy_status_types_office ON legacy.status_types(office_id);
CREATE INDEX idx_legacy_status_types_external ON legacy.status_types(office_id, external_id);

-- Case Types
CREATE TABLE IF NOT EXISTS legacy.case_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_case_types_office ON legacy.case_types(office_id);
CREATE INDEX idx_legacy_case_types_external ON legacy.case_types(office_id, external_id);

-- Category Types
CREATE TABLE IF NOT EXISTS legacy.category_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_category_types_office ON legacy.category_types(office_id);
CREATE INDEX idx_legacy_category_types_external ON legacy.category_types(office_id, external_id);

-- Contact Types (for constituent contact methods)
CREATE TABLE IF NOT EXISTS legacy.contact_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT, -- 'enquiry' or 'contact'
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_contact_types_office ON legacy.contact_types(office_id);
CREATE INDEX idx_legacy_contact_types_external ON legacy.contact_types(office_id, external_id);

-- Connection Types (relationships between constituents)
CREATE TABLE IF NOT EXISTS legacy.connection_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_connection_types_office ON legacy.connection_types(office_id);
CREATE INDEX idx_legacy_connection_types_external ON legacy.connection_types(office_id, external_id);

-- ============================================================================
-- LEGACY CORE ENTITY TABLES
-- These are the main entities synced from the legacy system
-- All tables include office_id for tenant isolation
-- ============================================================================

-- Caseworkers (staff members)
CREATE TABLE IF NOT EXISTS legacy.caseworkers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_caseworkers_office ON legacy.caseworkers(office_id);
CREATE INDEX idx_legacy_caseworkers_external ON legacy.caseworkers(office_id, external_id);
CREATE INDEX idx_legacy_caseworkers_email ON legacy.caseworkers(office_id, email);

-- Constituents
CREATE TABLE IF NOT EXISTS legacy.constituents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  organisation_type TEXT,
  geocode_lat DECIMAL,
  geocode_lng DECIMAL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_constituents_office ON legacy.constituents(office_id);
CREATE INDEX idx_legacy_constituents_external ON legacy.constituents(office_id, external_id);
CREATE INDEX idx_legacy_constituents_name ON legacy.constituents(office_id, last_name, first_name);

-- Contact Details (for constituents)
CREATE TABLE IF NOT EXISTS legacy.contact_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  constituent_id UUID REFERENCES legacy.constituents(id) ON DELETE CASCADE,
  constituent_external_id INTEGER NOT NULL,
  contact_type_id UUID REFERENCES legacy.contact_types(id),
  contact_type_external_id INTEGER,
  value TEXT NOT NULL,
  source TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_contact_details_office ON legacy.contact_details(office_id);
CREATE INDEX idx_legacy_contact_details_external ON legacy.contact_details(office_id, external_id);
CREATE INDEX idx_legacy_contact_details_constituent ON legacy.contact_details(office_id, constituent_id);
CREATE INDEX idx_legacy_contact_details_value ON legacy.contact_details(office_id, value);

-- Cases
CREATE TABLE IF NOT EXISTS legacy.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  constituent_id UUID REFERENCES legacy.constituents(id),
  constituent_external_id INTEGER,
  case_type_id UUID REFERENCES legacy.case_types(id),
  case_type_external_id INTEGER,
  status_id UUID REFERENCES legacy.status_types(id),
  status_external_id INTEGER,
  category_type_id UUID REFERENCES legacy.category_types(id),
  category_type_external_id INTEGER,
  contact_type_id UUID REFERENCES legacy.contact_types(id),
  contact_type_external_id INTEGER,
  assigned_to_id UUID REFERENCES legacy.caseworkers(id),
  assigned_to_external_id INTEGER,
  summary TEXT,
  review_date TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_cases_office ON legacy.cases(office_id);
CREATE INDEX idx_legacy_cases_external ON legacy.cases(office_id, external_id);
CREATE INDEX idx_legacy_cases_constituent ON legacy.cases(office_id, constituent_id);
CREATE INDEX idx_legacy_cases_status ON legacy.cases(office_id, status_id);
CREATE INDEX idx_legacy_cases_assigned ON legacy.cases(office_id, assigned_to_id);
CREATE INDEX idx_legacy_cases_created ON legacy.cases(office_id, created_at DESC);

-- Emails
CREATE TABLE IF NOT EXISTS legacy.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  case_id UUID REFERENCES legacy.cases(id),
  case_external_id INTEGER,
  constituent_id UUID REFERENCES legacy.constituents(id),
  constituent_external_id INTEGER,
  type TEXT, -- 'draft', 'sent', 'received', 'scheduled'
  subject TEXT,
  html_body TEXT,
  from_address TEXT,
  to_addresses JSONB, -- Array of email addresses
  cc_addresses JSONB,
  bcc_addresses JSONB,
  actioned BOOLEAN DEFAULT FALSE,
  assigned_to_id UUID REFERENCES legacy.caseworkers(id),
  assigned_to_external_id INTEGER,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_emails_office ON legacy.emails(office_id);
CREATE INDEX idx_legacy_emails_external ON legacy.emails(office_id, external_id);
CREATE INDEX idx_legacy_emails_case ON legacy.emails(office_id, case_id);
CREATE INDEX idx_legacy_emails_from ON legacy.emails(office_id, from_address);
CREATE INDEX idx_legacy_emails_actioned ON legacy.emails(office_id, actioned) WHERE actioned = FALSE;
CREATE INDEX idx_legacy_emails_received ON legacy.emails(office_id, received_at DESC);

-- Casenotes
CREATE TABLE IF NOT EXISTS legacy.casenotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  case_id UUID REFERENCES legacy.cases(id) ON DELETE CASCADE,
  case_external_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'note', 'email', 'letter', 'file', 'reviewDate', 'appointment'
  subtype_id INTEGER,
  content TEXT,
  actioned BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_casenotes_office ON legacy.casenotes(office_id);
CREATE INDEX idx_legacy_casenotes_external ON legacy.casenotes(office_id, external_id);
CREATE INDEX idx_legacy_casenotes_case ON legacy.casenotes(office_id, case_id);
CREATE INDEX idx_legacy_casenotes_type ON legacy.casenotes(office_id, type);

-- Tags
CREATE TABLE IF NOT EXISTS legacy.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id),
  UNIQUE(office_id, tag) -- Tag names unique within office
);

CREATE INDEX idx_legacy_tags_office ON legacy.tags(office_id);
CREATE INDEX idx_legacy_tags_external ON legacy.tags(office_id, external_id);
CREATE INDEX idx_legacy_tags_name ON legacy.tags(office_id, tag);

-- Case Tags (junction table)
CREATE TABLE IF NOT EXISTS legacy.case_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_id UUID REFERENCES legacy.cases(id) ON DELETE CASCADE,
  case_external_id INTEGER NOT NULL,
  tag_id UUID REFERENCES legacy.tags(id) ON DELETE CASCADE,
  tag_external_id INTEGER NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, case_id, tag_id)
);

CREATE INDEX idx_legacy_case_tags_office ON legacy.case_tags(office_id);
CREATE INDEX idx_legacy_case_tags_case ON legacy.case_tags(office_id, case_id);
CREATE INDEX idx_legacy_case_tags_tag ON legacy.case_tags(office_id, tag_id);

-- Flags (labels for constituents)
CREATE TABLE IF NOT EXISTS legacy.flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  flag TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id),
  UNIQUE(office_id, flag)
);

CREATE INDEX idx_legacy_flags_office ON legacy.flags(office_id);
CREATE INDEX idx_legacy_flags_external ON legacy.flags(office_id, external_id);

-- Constituent Flags (junction table)
CREATE TABLE IF NOT EXISTS legacy.constituent_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  constituent_id UUID REFERENCES legacy.constituents(id) ON DELETE CASCADE,
  constituent_external_id INTEGER NOT NULL,
  flag_id UUID REFERENCES legacy.flags(id) ON DELETE CASCADE,
  flag_external_id INTEGER NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, constituent_id, flag_id)
);

CREATE INDEX idx_legacy_constituent_flags_office ON legacy.constituent_flags(office_id);
CREATE INDEX idx_legacy_constituent_flags_constituent ON legacy.constituent_flags(office_id, constituent_id);
CREATE INDEX idx_legacy_constituent_flags_flag ON legacy.constituent_flags(office_id, flag_id);

-- Case Files
CREATE TABLE IF NOT EXISTS legacy.case_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  case_id UUID REFERENCES legacy.cases(id) ON DELETE CASCADE,
  case_external_id INTEGER NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  reference TEXT,
  storage_path TEXT, -- Path in Supabase Storage if content is stored
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_case_files_office ON legacy.case_files(office_id);
CREATE INDEX idx_legacy_case_files_external ON legacy.case_files(office_id, external_id);
CREATE INDEX idx_legacy_case_files_case ON legacy.case_files(office_id, case_id);

-- Email Attachments (missing from original schema)
CREATE TABLE IF NOT EXISTS legacy.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  email_id UUID REFERENCES legacy.emails(id) ON DELETE CASCADE,
  email_external_id INTEGER NOT NULL,
  type TEXT, -- 'caseFile', 'letter', 'emailAttachment'
  file_name TEXT,
  mime_type TEXT,
  storage_path TEXT,
  case_file_id UUID REFERENCES legacy.case_files(id),
  case_file_external_id INTEGER,
  signed BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_email_attachments_office ON legacy.email_attachments(office_id);
CREATE INDEX idx_legacy_email_attachments_email ON legacy.email_attachments(office_id, email_id);

-- Letters (missing from original schema)
CREATE TABLE IF NOT EXISTS legacy.letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  case_id UUID REFERENCES legacy.cases(id) ON DELETE CASCADE,
  case_external_id INTEGER NOT NULL,
  template_id INTEGER,
  content TEXT,
  recipient_name TEXT,
  recipient_address TEXT,
  status TEXT, -- 'draft', 'sent', 'printed'
  sent_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_letters_office ON legacy.letters(office_id);
CREATE INDEX idx_legacy_letters_external ON legacy.letters(office_id, external_id);
CREATE INDEX idx_legacy_letters_case ON legacy.letters(office_id, case_id);

-- Appointments (missing from original schema)
CREATE TABLE IF NOT EXISTS legacy.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  case_id UUID REFERENCES legacy.cases(id) ON DELETE CASCADE,
  case_external_id INTEGER NOT NULL,
  constituent_id UUID REFERENCES legacy.constituents(id),
  constituent_external_id INTEGER,
  assigned_to_id UUID REFERENCES legacy.caseworkers(id),
  assigned_to_external_id INTEGER,
  title TEXT,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_appointments_office ON legacy.appointments(office_id);
CREATE INDEX idx_legacy_appointments_external ON legacy.appointments(office_id, external_id);
CREATE INDEX idx_legacy_appointments_case ON legacy.appointments(office_id, case_id);
CREATE INDEX idx_legacy_appointments_start ON legacy.appointments(office_id, start_at);

-- Review Dates
CREATE TABLE IF NOT EXISTS legacy.review_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  case_id UUID REFERENCES legacy.cases(id) ON DELETE CASCADE,
  case_external_id INTEGER NOT NULL,
  assigned_to_id UUID REFERENCES legacy.caseworkers(id),
  assigned_to_external_id INTEGER,
  review_date TIMESTAMPTZ NOT NULL,
  note TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_review_dates_office ON legacy.review_dates(office_id);
CREATE INDEX idx_legacy_review_dates_external ON legacy.review_dates(office_id, external_id);
CREATE INDEX idx_legacy_review_dates_case ON legacy.review_dates(office_id, case_id);
CREATE INDEX idx_legacy_review_dates_date ON legacy.review_dates(office_id, review_date);

-- Connections (relationships between constituents)
CREATE TABLE IF NOT EXISTS legacy.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  parent_id UUID REFERENCES legacy.constituents(id),
  parent_external_id INTEGER NOT NULL,
  child_id UUID REFERENCES legacy.constituents(id),
  child_external_id INTEGER NOT NULL,
  connection_type_id UUID REFERENCES legacy.connection_types(id),
  connection_type_external_id INTEGER,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_connections_office ON legacy.connections(office_id);
CREATE INDEX idx_legacy_connections_external ON legacy.connections(office_id, external_id);
CREATE INDEX idx_legacy_connections_parent ON legacy.connections(office_id, parent_id);
CREATE INDEX idx_legacy_connections_child ON legacy.connections(office_id, child_id);

-- Custom Field Definitions
CREATE TABLE IF NOT EXISTS legacy.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_custom_fields_office ON legacy.custom_field_definitions(office_id);
CREATE INDEX idx_legacy_custom_fields_external ON legacy.custom_field_definitions(office_id, external_id);

-- Custom Field Values
CREATE TABLE IF NOT EXISTS legacy.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER,
  case_id UUID REFERENCES legacy.cases(id) ON DELETE CASCADE,
  case_external_id INTEGER NOT NULL,
  custom_field_id UUID REFERENCES legacy.custom_field_definitions(id),
  custom_field_external_id INTEGER NOT NULL,
  value TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, case_id, custom_field_id)
);

CREATE INDEX idx_legacy_custom_values_office ON legacy.custom_field_values(office_id);
CREATE INDEX idx_legacy_custom_values_case ON legacy.custom_field_values(office_id, case_id);

-- SMS Messages (missing from original schema)
CREATE TABLE IF NOT EXISTS legacy.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  external_id INTEGER NOT NULL,
  case_id UUID REFERENCES legacy.cases(id),
  case_external_id INTEGER,
  constituent_id UUID REFERENCES legacy.constituents(id),
  constituent_external_id INTEGER,
  from_number TEXT,
  to_number TEXT,
  body TEXT,
  direction TEXT, -- 'inbound', 'outbound'
  actioned BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, external_id)
);

CREATE INDEX idx_legacy_sms_office ON legacy.sms_messages(office_id);
CREATE INDEX idx_legacy_sms_external ON legacy.sms_messages(office_id, external_id);
CREATE INDEX idx_legacy_sms_case ON legacy.sms_messages(office_id, case_id);

-- ============================================================================
-- SYNC TRACKING TABLE
-- Tracks synchronization status and timing for each entity type PER OFFICE
-- ============================================================================

CREATE TABLE IF NOT EXISTS legacy.sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'cases', 'constituents', 'emails', etc.
  last_sync_started_at TIMESTAMPTZ,
  last_sync_completed_at TIMESTAMPTZ,
  last_sync_cursor TEXT, -- For cursor-based pagination
  last_sync_success BOOLEAN,
  last_sync_error TEXT,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, entity_type)
);

CREATE INDEX idx_legacy_sync_status_office ON legacy.sync_status(office_id);

-- ============================================================================
-- SYNC AUDIT LOG
-- Tracks all sync operations for debugging and compliance
-- ============================================================================

CREATE TABLE IF NOT EXISTS legacy.sync_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'create', 'update', 'delete', 'conflict'
  external_id INTEGER,
  internal_id UUID,
  old_data JSONB,
  new_data JSONB,
  conflict_resolution TEXT, -- 'legacy_wins', 'local_wins', 'merged'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_legacy_sync_audit_office ON legacy.sync_audit_log(office_id);
CREATE INDEX idx_legacy_sync_audit_entity ON legacy.sync_audit_log(office_id, entity_type);
CREATE INDEX idx_legacy_sync_audit_created ON legacy.sync_audit_log(office_id, created_at DESC);

-- ============================================================================
-- LEGACY CREDENTIALS TABLE
-- Stores per-office credentials for legacy API access (encrypted)
-- ============================================================================

CREATE TABLE IF NOT EXISTS legacy.api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL UNIQUE REFERENCES public.offices(id) ON DELETE CASCADE,
  api_base_url TEXT NOT NULL,
  -- These should be encrypted with pgcrypto in production
  encrypted_token TEXT, -- JWT token (encrypted)
  token_expires_at TIMESTAMPTZ,
  encrypted_email TEXT, -- Service account email (encrypted)
  encrypted_password TEXT, -- Service account password (encrypted)
  last_auth_at TIMESTAMPTZ,
  last_auth_error TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION legacy.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all legacy tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'legacy' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON legacy.%I;
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON legacy.%I
        FOR EACH ROW EXECUTE FUNCTION legacy.update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ============================================================================
-- UPSERT HELPER FUNCTIONS (Office-Scoped)
-- ============================================================================

-- Function to upsert constituent
CREATE OR REPLACE FUNCTION legacy.upsert_constituent(
  p_office_id UUID,
  p_external_id INTEGER,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_organisation_type TEXT DEFAULT NULL,
  p_geocode_lat DECIMAL DEFAULT NULL,
  p_geocode_lng DECIMAL DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO legacy.constituents (
    office_id, external_id, first_name, last_name, title, organisation_type,
    geocode_lat, geocode_lng, last_synced_at
  ) VALUES (
    p_office_id, p_external_id, p_first_name, p_last_name, p_title, p_organisation_type,
    p_geocode_lat, p_geocode_lng, NOW()
  )
  ON CONFLICT (office_id, external_id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, legacy.constituents.first_name),
    last_name = COALESCE(EXCLUDED.last_name, legacy.constituents.last_name),
    title = COALESCE(EXCLUDED.title, legacy.constituents.title),
    organisation_type = COALESCE(EXCLUDED.organisation_type, legacy.constituents.organisation_type),
    geocode_lat = COALESCE(EXCLUDED.geocode_lat, legacy.constituents.geocode_lat),
    geocode_lng = COALESCE(EXCLUDED.geocode_lng, legacy.constituents.geocode_lng),
    last_synced_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert case
CREATE OR REPLACE FUNCTION legacy.upsert_case(
  p_office_id UUID,
  p_external_id INTEGER,
  p_constituent_external_id INTEGER DEFAULT NULL,
  p_case_type_external_id INTEGER DEFAULT NULL,
  p_status_external_id INTEGER DEFAULT NULL,
  p_category_type_external_id INTEGER DEFAULT NULL,
  p_contact_type_external_id INTEGER DEFAULT NULL,
  p_assigned_to_external_id INTEGER DEFAULT NULL,
  p_summary TEXT DEFAULT NULL,
  p_review_date TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_constituent_id UUID;
  v_case_type_id UUID;
  v_status_id UUID;
  v_category_type_id UUID;
  v_contact_type_id UUID;
  v_assigned_to_id UUID;
BEGIN
  -- Lookup internal IDs from external IDs (office-scoped)
  SELECT id INTO v_constituent_id FROM legacy.constituents
    WHERE office_id = p_office_id AND external_id = p_constituent_external_id;
  SELECT id INTO v_case_type_id FROM legacy.case_types
    WHERE office_id = p_office_id AND external_id = p_case_type_external_id;
  SELECT id INTO v_status_id FROM legacy.status_types
    WHERE office_id = p_office_id AND external_id = p_status_external_id;
  SELECT id INTO v_category_type_id FROM legacy.category_types
    WHERE office_id = p_office_id AND external_id = p_category_type_external_id;
  SELECT id INTO v_contact_type_id FROM legacy.contact_types
    WHERE office_id = p_office_id AND external_id = p_contact_type_external_id;
  SELECT id INTO v_assigned_to_id FROM legacy.caseworkers
    WHERE office_id = p_office_id AND external_id = p_assigned_to_external_id;

  INSERT INTO legacy.cases (
    office_id, external_id, constituent_id, constituent_external_id,
    case_type_id, case_type_external_id,
    status_id, status_external_id,
    category_type_id, category_type_external_id,
    contact_type_id, contact_type_external_id,
    assigned_to_id, assigned_to_external_id,
    summary, review_date, last_synced_at
  ) VALUES (
    p_office_id, p_external_id, v_constituent_id, p_constituent_external_id,
    v_case_type_id, p_case_type_external_id,
    v_status_id, p_status_external_id,
    v_category_type_id, p_category_type_external_id,
    v_contact_type_id, p_contact_type_external_id,
    v_assigned_to_id, p_assigned_to_external_id,
    p_summary, p_review_date, NOW()
  )
  ON CONFLICT (office_id, external_id) DO UPDATE SET
    constituent_id = COALESCE(v_constituent_id, legacy.cases.constituent_id),
    constituent_external_id = COALESCE(EXCLUDED.constituent_external_id, legacy.cases.constituent_external_id),
    case_type_id = COALESCE(v_case_type_id, legacy.cases.case_type_id),
    case_type_external_id = COALESCE(EXCLUDED.case_type_external_id, legacy.cases.case_type_external_id),
    status_id = COALESCE(v_status_id, legacy.cases.status_id),
    status_external_id = COALESCE(EXCLUDED.status_external_id, legacy.cases.status_external_id),
    category_type_id = COALESCE(v_category_type_id, legacy.cases.category_type_id),
    category_type_external_id = COALESCE(EXCLUDED.category_type_external_id, legacy.cases.category_type_external_id),
    contact_type_id = COALESCE(v_contact_type_id, legacy.cases.contact_type_id),
    contact_type_external_id = COALESCE(EXCLUDED.contact_type_external_id, legacy.cases.contact_type_external_id),
    assigned_to_id = COALESCE(v_assigned_to_id, legacy.cases.assigned_to_id),
    assigned_to_external_id = COALESCE(EXCLUDED.assigned_to_external_id, legacy.cases.assigned_to_external_id),
    summary = COALESCE(EXCLUDED.summary, legacy.cases.summary),
    review_date = COALESCE(EXCLUDED.review_date, legacy.cases.review_date),
    last_synced_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert email
CREATE OR REPLACE FUNCTION legacy.upsert_email(
  p_office_id UUID,
  p_external_id INTEGER,
  p_case_external_id INTEGER DEFAULT NULL,
  p_constituent_external_id INTEGER DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_html_body TEXT DEFAULT NULL,
  p_from_address TEXT DEFAULT NULL,
  p_to_addresses JSONB DEFAULT NULL,
  p_cc_addresses JSONB DEFAULT NULL,
  p_bcc_addresses JSONB DEFAULT NULL,
  p_actioned BOOLEAN DEFAULT FALSE,
  p_assigned_to_external_id INTEGER DEFAULT NULL,
  p_scheduled_at TIMESTAMPTZ DEFAULT NULL,
  p_sent_at TIMESTAMPTZ DEFAULT NULL,
  p_received_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_case_id UUID;
  v_constituent_id UUID;
  v_assigned_to_id UUID;
BEGIN
  SELECT id INTO v_case_id FROM legacy.cases
    WHERE office_id = p_office_id AND external_id = p_case_external_id;
  SELECT id INTO v_constituent_id FROM legacy.constituents
    WHERE office_id = p_office_id AND external_id = p_constituent_external_id;
  SELECT id INTO v_assigned_to_id FROM legacy.caseworkers
    WHERE office_id = p_office_id AND external_id = p_assigned_to_external_id;

  INSERT INTO legacy.emails (
    office_id, external_id, case_id, case_external_id,
    constituent_id, constituent_external_id,
    type, subject, html_body, from_address,
    to_addresses, cc_addresses, bcc_addresses,
    actioned, assigned_to_id, assigned_to_external_id,
    scheduled_at, sent_at, received_at, last_synced_at
  ) VALUES (
    p_office_id, p_external_id, v_case_id, p_case_external_id,
    v_constituent_id, p_constituent_external_id,
    p_type, p_subject, p_html_body, p_from_address,
    p_to_addresses, p_cc_addresses, p_bcc_addresses,
    p_actioned, v_assigned_to_id, p_assigned_to_external_id,
    p_scheduled_at, p_sent_at, p_received_at, NOW()
  )
  ON CONFLICT (office_id, external_id) DO UPDATE SET
    case_id = COALESCE(v_case_id, legacy.emails.case_id),
    case_external_id = COALESCE(EXCLUDED.case_external_id, legacy.emails.case_external_id),
    constituent_id = COALESCE(v_constituent_id, legacy.emails.constituent_id),
    constituent_external_id = COALESCE(EXCLUDED.constituent_external_id, legacy.emails.constituent_external_id),
    type = COALESCE(EXCLUDED.type, legacy.emails.type),
    subject = COALESCE(EXCLUDED.subject, legacy.emails.subject),
    html_body = COALESCE(EXCLUDED.html_body, legacy.emails.html_body),
    from_address = COALESCE(EXCLUDED.from_address, legacy.emails.from_address),
    to_addresses = COALESCE(EXCLUDED.to_addresses, legacy.emails.to_addresses),
    cc_addresses = COALESCE(EXCLUDED.cc_addresses, legacy.emails.cc_addresses),
    bcc_addresses = COALESCE(EXCLUDED.bcc_addresses, legacy.emails.bcc_addresses),
    actioned = COALESCE(EXCLUDED.actioned, legacy.emails.actioned),
    assigned_to_id = COALESCE(v_assigned_to_id, legacy.emails.assigned_to_id),
    assigned_to_external_id = COALESCE(EXCLUDED.assigned_to_external_id, legacy.emails.assigned_to_external_id),
    scheduled_at = COALESCE(EXCLUDED.scheduled_at, legacy.emails.scheduled_at),
    sent_at = COALESCE(EXCLUDED.sent_at, legacy.emails.sent_at),
    received_at = COALESCE(EXCLUDED.received_at, legacy.emails.received_at),
    last_synced_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS AND RLS (Multi-Tenant)
-- ============================================================================

-- Grant usage on legacy schema to authenticated users
GRANT USAGE ON SCHEMA legacy TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA legacy TO authenticated;

-- Service role has full access
GRANT ALL ON SCHEMA legacy TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA legacy TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA legacy TO service_role;

-- Enable RLS on all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'legacy' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE legacy.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Create office-scoped RLS policies for all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'legacy' AND table_type = 'BASE TABLE'
  LOOP
    -- Drop existing policies
    EXECUTE format('DROP POLICY IF EXISTS "Office isolation read" ON legacy.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON legacy.%I;', t);

    -- Authenticated users can only read their office's data
    EXECUTE format('
      CREATE POLICY "Office isolation read" ON legacy.%I
        FOR SELECT TO authenticated
        USING (office_id = public.get_my_office_id());
    ', t);

    -- Service role has full access for sync operations
    EXECUTE format('
      CREATE POLICY "Service role full access" ON legacy.%I
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
    ', t);
  END LOOP;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA legacy IS 'Shadow database for legacy Caseworker system integration (multi-tenant)';
COMMENT ON TABLE legacy.sync_status IS 'Tracks synchronization status per office for each entity type';
COMMENT ON TABLE legacy.sync_audit_log IS 'Audit trail for all sync operations with conflict resolution';
COMMENT ON TABLE legacy.api_credentials IS 'Encrypted credentials for legacy API access per office';
COMMENT ON FUNCTION legacy.upsert_constituent IS 'Upserts a constituent from legacy system data (office-scoped)';
COMMENT ON FUNCTION legacy.upsert_case IS 'Upserts a case from legacy system data (office-scoped)';
COMMENT ON FUNCTION legacy.upsert_email IS 'Upserts an email from legacy system data (office-scoped)';
