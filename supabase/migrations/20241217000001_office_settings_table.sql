-- Office Settings Table Migration
-- Creates a separate table for office configuration settings

-- ============================================================================
-- OFFICE SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.office_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,

  -- AI Settings
  ai_classification_enabled BOOLEAN DEFAULT true,
  ai_draft_response_enabled BOOLEAN DEFAULT true,
  ai_tagging_enabled BOOLEAN DEFAULT true,

  -- Assignment Settings
  auto_assign_enabled BOOLEAN DEFAULT true,
  round_robin_enabled BOOLEAN DEFAULT false,
  default_casework_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  default_policy_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Response Style Settings
  policy_response_style TEXT DEFAULT 'formal' CHECK (policy_response_style IN ('formal', 'friendly', 'brief')),
  casework_acknowledgment_enabled BOOLEAN DEFAULT false,

  -- MP/Office Identity Settings (for email signatures)
  mp_name TEXT,
  mp_email TEXT,
  signature_template TEXT,
  inbound_email TEXT, -- The email address that receives inbound mail for this office

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One settings record per office
  UNIQUE(office_id)
);

-- Index for quick lookup by office
CREATE INDEX IF NOT EXISTS idx_office_settings_office_id ON public.office_settings(office_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE TRIGGER update_office_settings_updated_at
  BEFORE UPDATE ON public.office_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their office settings
CREATE POLICY "Users can view their office settings"
  ON public.office_settings
  FOR SELECT
  TO authenticated
  USING (office_id = get_my_office_id());

-- Admins can manage their office settings
CREATE POLICY "Admins can manage their office settings"
  ON public.office_settings
  FOR ALL
  TO authenticated
  USING (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    office_id = get_my_office_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- MIGRATE EXISTING DATA
-- ============================================================================

-- Create settings records for existing offices, migrating data from offices.settings JSONB
INSERT INTO public.office_settings (office_id, inbound_email, created_at, updated_at)
SELECT
  id,
  settings->>'inbound_email',
  created_at,
  updated_at
FROM public.offices
WHERE NOT EXISTS (
  SELECT 1 FROM public.office_settings WHERE office_id = offices.id
)
ON CONFLICT (office_id) DO NOTHING;

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

-- Add trigger for audit logging on office_settings
CREATE TRIGGER audit_office_settings_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.office_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_auto_audit();

-- ============================================================================
-- FUNCTION TO GET OFFICE SETTINGS WITH DEFAULTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_office_settings(p_office_id UUID)
RETURNS public.office_settings AS $$
DECLARE
  v_settings public.office_settings;
BEGIN
  SELECT * INTO v_settings
  FROM public.office_settings
  WHERE office_id = p_office_id;

  -- If no settings exist, create default settings
  IF v_settings IS NULL THEN
    INSERT INTO public.office_settings (office_id)
    VALUES (p_office_id)
    RETURNING * INTO v_settings;
  END IF;

  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
