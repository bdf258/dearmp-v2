-- ============================================================================
-- SYNC LEGACY EMAILS TO PUBLIC MESSAGES
-- ============================================================================
-- Creates a trigger that automatically syncs records from legacy.emails
-- to public.messages, enabling the triage UI to work with legacy data.
--
-- Data flow:
-- 1. SyncService pulls from Caseworker API → legacy.emails
-- 2. This trigger copies legacy.emails → public.messages
-- 3. Triage UI works on public.messages
-- 4. Triage decisions sync back to legacy system via API
-- ============================================================================

-- ============================================================================
-- SYNC FUNCTION: legacy.emails → public.messages
-- ============================================================================
CREATE OR REPLACE FUNCTION legacy.sync_email_to_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, legacy
AS $$
DECLARE
  v_message_id UUID;
  v_from_name TEXT;
  v_to_email TEXT;
  v_body_text TEXT;
  v_snippet TEXT;
BEGIN
  -- Extract from_name from from_address (e.g., "John Smith <john@example.com>" → "John Smith")
  IF NEW.from_address ~ '<.+>' THEN
    v_from_name := trim(regexp_replace(NEW.from_address, '<.+>$', ''));
    IF v_from_name = '' THEN
      v_from_name := NULL;
    END IF;
  END IF;

  -- Get first to_address
  IF NEW.to_addresses IS NOT NULL AND jsonb_array_length(NEW.to_addresses) > 0 THEN
    v_to_email := NEW.to_addresses->>0;
  ELSE
    v_to_email := 'unknown@office.gov.uk';
  END IF;

  -- Extract plain text from HTML for body
  v_body_text := regexp_replace(
    regexp_replace(
      COALESCE(NEW.html_body, ''),
      '<[^>]+>', ' ', 'g'  -- Remove HTML tags
    ),
    '\s+', ' ', 'g'  -- Collapse whitespace
  );
  v_body_text := trim(v_body_text);

  -- Create snippet (first 200 chars)
  v_snippet := left(v_body_text, 200);

  -- Check if message already exists (by external_id reference stored in metadata)
  SELECT id INTO v_message_id
  FROM public.messages
  WHERE office_id = NEW.office_id
    AND (metadata->>'legacy_external_id')::integer = NEW.external_id;

  IF v_message_id IS NOT NULL THEN
    -- Update existing message
    UPDATE public.messages SET
      from_email = COALESCE(NEW.from_address, from_email),
      from_name = COALESCE(v_from_name, from_name),
      subject = COALESCE(NEW.subject, subject),
      snippet = COALESCE(v_snippet, snippet),
      body = COALESCE(v_body_text, body),
      body_html = COALESCE(NEW.html_body, body_html),
      received_at = COALESCE(NEW.received_at, received_at),
      is_triage_needed = NOT COALESCE(NEW.actioned, false),
      -- Map case_id from legacy to public if exists
      case_id = (
        SELECT c.id FROM public.cases c
        WHERE c.office_id = NEW.office_id
          AND c.reference_number = NEW.case_external_id::text
        LIMIT 1
      ),
      updated_at = NOW(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{legacy_synced_at}',
        to_jsonb(NOW()::text)
      )
    WHERE id = v_message_id;
  ELSE
    -- Insert new message
    INSERT INTO public.messages (
      id,
      office_id,
      from_email,
      from_name,
      to_email,
      to_name,
      subject,
      snippet,
      body,
      body_html,
      direction,
      is_triage_needed,
      received_at,
      created_at,
      updated_at,
      metadata
    ) VALUES (
      gen_random_uuid(),
      NEW.office_id,
      COALESCE(NEW.from_address, 'unknown@unknown.com'),
      v_from_name,
      v_to_email,
      NULL,
      COALESCE(NEW.subject, '(No subject)'),
      v_snippet,
      COALESCE(v_body_text, ''),
      NEW.html_body,
      CASE WHEN NEW.type = 'received' THEN 'inbound' ELSE 'outbound' END,
      NOT COALESCE(NEW.actioned, false),
      COALESCE(NEW.received_at, NEW.created_at, NOW()),
      NEW.created_at,
      NOW(),
      jsonb_build_object(
        'legacy_external_id', NEW.external_id,
        'legacy_id', NEW.id,
        'legacy_synced_at', NOW()::text
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGER: Auto-sync on legacy.emails insert/update
-- ============================================================================
DROP TRIGGER IF EXISTS sync_legacy_email_to_messages ON legacy.emails;

CREATE TRIGGER sync_legacy_email_to_messages
  AFTER INSERT OR UPDATE ON legacy.emails
  FOR EACH ROW
  EXECUTE FUNCTION legacy.sync_email_to_messages();

-- ============================================================================
-- REVERSE SYNC: public.messages updates → legacy.emails
-- When triage actions update public.messages, sync back to legacy.emails
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_message_to_legacy_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, legacy
AS $$
DECLARE
  v_legacy_external_id INTEGER;
BEGIN
  -- Get the legacy external_id from metadata
  v_legacy_external_id := (NEW.metadata->>'legacy_external_id')::integer;

  -- Only sync if this message came from legacy
  IF v_legacy_external_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update the legacy email
  UPDATE legacy.emails SET
    actioned = NOT COALESCE(NEW.is_triage_needed, true),
    case_external_id = (
      SELECT c.reference_number::integer
      FROM public.cases c
      WHERE c.id = NEW.case_id
      LIMIT 1
    ),
    updated_at = NOW()
  WHERE office_id = NEW.office_id
    AND external_id = v_legacy_external_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_message_to_legacy_email ON public.messages;

CREATE TRIGGER sync_message_to_legacy_email
  AFTER UPDATE ON public.messages
  FOR EACH ROW
  WHEN (
    OLD.is_triage_needed IS DISTINCT FROM NEW.is_triage_needed
    OR OLD.case_id IS DISTINCT FROM NEW.case_id
  )
  EXECUTE FUNCTION public.sync_message_to_legacy_email();

-- ============================================================================
-- ADD METADATA COLUMN TO MESSAGES IF NOT EXISTS
-- Stores legacy references for bidirectional sync
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    CREATE INDEX idx_messages_legacy_external_id ON public.messages((metadata->>'legacy_external_id'));
  END IF;
END $$;

-- ============================================================================
-- INITIAL BACKFILL: Sync existing legacy.emails to public.messages
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER := 0;
  v_email RECORD;
BEGIN
  FOR v_email IN
    SELECT * FROM legacy.emails
    WHERE NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.office_id = legacy.emails.office_id
        AND (m.metadata->>'legacy_external_id')::integer = legacy.emails.external_id
    )
    ORDER BY received_at DESC
    LIMIT 1000  -- Process in batches to avoid timeout
  LOOP
    -- The trigger will handle the insert
    UPDATE legacy.emails
    SET updated_at = NOW()
    WHERE id = v_email.id;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled % legacy emails to public.messages', v_count;
END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT EXECUTE ON FUNCTION legacy.sync_email_to_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_message_to_legacy_email() TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION legacy.sync_email_to_messages IS 'Syncs legacy.emails to public.messages for UI consumption';
COMMENT ON FUNCTION public.sync_message_to_legacy_email IS 'Syncs triage decisions from public.messages back to legacy.emails';
