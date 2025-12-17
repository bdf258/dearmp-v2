-- Migration: Partition tables by office_id and upgrade to UUID v7
-- This migration improves write performance at scale by:
-- 1. Using UUID v7 (time-ordered) instead of v4 (random) to reduce index fragmentation
-- 2. Using list partitioning by office_id for better query performance and data isolation

-- =====================================================
-- 1. CREATE UUID v7 GENERATION FUNCTION
-- UUID v7 includes a timestamp component for time-ordered inserts
-- This reduces B-tree index page splitting and improves write performance
-- =====================================================

CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
AS $$
DECLARE
  unix_ts_ms BIGINT;
  uuid_bytes BYTEA;
BEGIN
  -- Get current timestamp in milliseconds
  unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;

  -- Build UUID v7:
  -- - First 48 bits: Unix timestamp in milliseconds
  -- - Next 4 bits: Version (7)
  -- - Next 12 bits: Random
  -- - Next 2 bits: Variant (10)
  -- - Last 62 bits: Random
  uuid_bytes := set_byte(
    set_byte(
      set_byte(
        set_byte(
          set_byte(
            set_byte(
              decode(lpad(to_hex(unix_ts_ms), 12, '0'), 'hex') || gen_random_bytes(10),
              6, (get_byte(gen_random_bytes(1), 0) & x'0f'::int) | x'70'::int  -- Version 7
            ),
            8, (get_byte(gen_random_bytes(1), 0) & x'3f'::int) | x'80'::int  -- Variant 10
          ),
          7, get_byte(gen_random_bytes(1), 0)
        ),
        9, get_byte(gen_random_bytes(1), 0)
      ),
      10, get_byte(gen_random_bytes(1), 0)
    ),
    11, get_byte(gen_random_bytes(1), 0)
  );

  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION uuid_generate_v7() IS
  'Generates a UUID v7 with timestamp prefix for time-ordered inserts.
   Reduces B-tree index fragmentation compared to random UUID v4.';

-- =====================================================
-- 2. CREATE HELPER FUNCTION FOR PARTITION MANAGEMENT
-- This function creates new partitions dynamically for offices
-- =====================================================

CREATE OR REPLACE FUNCTION create_office_partition(
  p_table_name TEXT,
  p_office_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_partition_name TEXT;
  v_sql TEXT;
BEGIN
  -- Generate partition name (table_office_<short_id>)
  v_partition_name := p_table_name || '_office_' || replace(p_office_id::text, '-', '_');

  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = v_partition_name AND n.nspname = 'public'
  ) THEN
    v_sql := format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I FOR VALUES IN (%L)',
      v_partition_name,
      p_table_name,
      p_office_id
    );
    EXECUTE v_sql;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. PARTITION MESSAGES TABLE
-- =====================================================

-- 3a. Rename existing table
ALTER TABLE IF EXISTS public.messages RENAME TO messages_old;

-- 3b. Drop dependent objects that reference the old table
DROP TRIGGER IF EXISTS audit_messages_changes ON public.messages_old;
DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages_old;
DROP TRIGGER IF EXISTS trigger_queue_new_message ON public.messages_old;

-- 3c. Create new partitioned table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT uuid_generate_v7(),
  office_id UUID NOT NULL,
  case_id UUID,
  campaign_id UUID,
  direction message_direction NOT NULL,
  channel message_channel DEFAULT 'email'::message_channel,
  subject TEXT,
  snippet TEXT,
  storage_path_html TEXT,
  storage_path_text TEXT,
  message_id_header TEXT,
  in_reply_to_header TEXT,
  thread_id TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  body_search_text TEXT,
  search_vector tsvector DEFAULT to_tsvector('english'::regconfig, ''::text),
  PRIMARY KEY (office_id, id)
) PARTITION BY LIST (office_id);

-- 3d. Create default partition for messages (catches any office without explicit partition)
CREATE TABLE public.messages_default PARTITION OF public.messages DEFAULT;

-- 3e. Create indexes on partitioned table (will be inherited by partitions)
CREATE INDEX idx_messages_id ON public.messages (id);
CREATE INDEX idx_messages_case ON public.messages (case_id);
CREATE INDEX idx_messages_campaign ON public.messages (campaign_id);
CREATE INDEX idx_messages_received ON public.messages (received_at DESC);
CREATE INDEX idx_messages_search ON public.messages USING gin (search_vector);
CREATE INDEX idx_messages_thread ON public.messages (thread_id);
CREATE INDEX idx_messages_message_id_header ON public.messages (message_id_header);

-- 3f. Migrate data from old table
INSERT INTO public.messages (
  id, office_id, case_id, campaign_id, direction, channel, subject, snippet,
  storage_path_html, storage_path_text, message_id_header, in_reply_to_header,
  thread_id, received_at, sent_at, body_search_text, search_vector
)
SELECT
  id, office_id, case_id, campaign_id, direction, channel, subject, snippet,
  storage_path_html, storage_path_text, message_id_header, in_reply_to_header,
  thread_id, received_at, sent_at, body_search_text, search_vector
FROM public.messages_old;

-- 3g. Re-add foreign key constraints
ALTER TABLE public.messages
  ADD CONSTRAINT messages_office_id_fkey
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- 3h. Re-enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3i. Re-create RLS policies
CREATE POLICY "Messages office policy"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (office_id = get_my_office_id())
  WITH CHECK (office_id = get_my_office_id());

-- 3j. Re-create trigger for search vector update
CREATE OR REPLACE FUNCTION update_messages_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.subject, '') || ' ' || COALESCE(NEW.body_search_text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_messages_search_vector
  BEFORE INSERT OR UPDATE OF subject, body_search_text ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_messages_search_vector();

-- 3k. Re-create audit trigger
CREATE TRIGGER audit_messages_changes
  AFTER DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION trigger_auto_audit();

-- =====================================================
-- 4. PARTITION AUDIT_LOGS TABLE
-- =====================================================

-- 4a. Rename existing table
ALTER TABLE IF EXISTS public.audit_logs RENAME TO audit_logs_old;

-- 4b. Create new partitioned table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT uuid_generate_v7(),
  office_id UUID NOT NULL,
  actor_id UUID,
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (office_id, id)
) PARTITION BY LIST (office_id);

-- 4c. Create default partition
CREATE TABLE public.audit_logs_default PARTITION OF public.audit_logs DEFAULT;

-- 4d. Create indexes
CREATE INDEX idx_audit_logs_id ON public.audit_logs (id);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);

-- 4e. Migrate data
INSERT INTO public.audit_logs (
  id, office_id, actor_id, action, entity_type, entity_id, metadata, ip_address, created_at
)
SELECT
  id, office_id, actor_id, action, entity_type, entity_id, metadata, ip_address, created_at
FROM public.audit_logs_old;

-- 4f. Re-add foreign key constraints
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_office_id_fkey
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES profiles(id);

-- 4g. Re-enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4h. Re-create RLS policies
CREATE POLICY "Audit Policy"
  ON public.audit_logs
  FOR SELECT
  USING (office_id = get_my_office_id());

CREATE POLICY "Audit Insert Policy"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (office_id = get_my_office_id());

-- =====================================================
-- 5. PARTITION ATTACHMENTS TABLE
-- =====================================================

-- 5a. Rename existing table
ALTER TABLE IF EXISTS public.attachments RENAME TO attachments_old;

-- 5b. Create new partitioned table
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT uuid_generate_v7(),
  office_id UUID NOT NULL,
  message_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (office_id, id)
) PARTITION BY LIST (office_id);

-- 5c. Create default partition
CREATE TABLE public.attachments_default PARTITION OF public.attachments DEFAULT;

-- 5d. Create indexes
CREATE INDEX idx_attachments_id ON public.attachments (id);
CREATE INDEX idx_attachments_message ON public.attachments (message_id);
CREATE INDEX idx_attachments_created ON public.attachments (created_at DESC);

-- 5e. Migrate data
INSERT INTO public.attachments (
  id, office_id, message_id, filename, file_size, mime_type, storage_path, created_at
)
SELECT
  id, office_id, message_id, filename, file_size, mime_type, storage_path, created_at
FROM public.attachments_old;

-- 5f. Re-add foreign key constraints
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_office_id_fkey
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE;

-- Note: We cannot add FK to partitioned messages table directly
-- The message_id FK is validated at application level

-- 5g. Re-enable RLS
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- 5h. Re-create RLS policies
CREATE POLICY "Attachments Policy"
  ON public.attachments
  FOR ALL
  USING (office_id = get_my_office_id());

-- =====================================================
-- 6. UPDATE RELATED TABLES' FOREIGN KEYS
-- =====================================================

-- Update message_recipients to reference new messages table
-- Note: Need to drop and recreate FK since messages PK changed
ALTER TABLE public.message_recipients
  DROP CONSTRAINT IF EXISTS message_recipients_message_id_fkey;

-- Note: Cannot add FK from non-partitioned to partitioned table's non-partition-key column
-- Application must handle referential integrity for message_id

-- Update bulk_response_log FK
ALTER TABLE public.bulk_response_log
  DROP CONSTRAINT IF EXISTS bulk_response_log_generated_message_id_fkey;

-- =====================================================
-- 7. CREATE FUNCTION TO AUTO-CREATE PARTITIONS FOR NEW OFFICES
-- =====================================================

CREATE OR REPLACE FUNCTION create_office_partitions()
RETURNS TRIGGER AS $$
BEGIN
  -- Create partitions for all three tables when a new office is created
  PERFORM create_office_partition('messages', NEW.id);
  PERFORM create_office_partition('audit_logs', NEW.id);
  PERFORM create_office_partition('attachments', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_office_partitions
  AFTER INSERT ON public.offices
  FOR EACH ROW EXECUTE FUNCTION create_office_partitions();

-- =====================================================
-- 8. CREATE PARTITIONS FOR EXISTING OFFICES
-- =====================================================

DO $$
DECLARE
  v_office_id UUID;
BEGIN
  FOR v_office_id IN SELECT id FROM public.offices LOOP
    PERFORM create_office_partition('messages', v_office_id);
    PERFORM create_office_partition('audit_logs', v_office_id);
    PERFORM create_office_partition('attachments', v_office_id);
  END LOOP;
END $$;

-- =====================================================
-- 9. MOVE DATA FROM DEFAULT TO PROPER PARTITIONS
-- After creating office-specific partitions, we need to move
-- data from default partition to the correct office partitions
-- =====================================================

-- For messages: detach default, reattach with proper routing
DO $$
DECLARE
  v_office_id UUID;
BEGIN
  -- Move data from default partition to proper partitions
  FOR v_office_id IN
    SELECT DISTINCT office_id FROM public.messages_default
  LOOP
    -- Ensure partition exists
    PERFORM create_office_partition('messages', v_office_id);

    -- Move data (PostgreSQL will route to correct partition on insert)
    INSERT INTO public.messages
    SELECT * FROM public.messages_default WHERE office_id = v_office_id;

    -- Delete from default
    DELETE FROM public.messages_default WHERE office_id = v_office_id;
  END LOOP;
END $$;

DO $$
DECLARE
  v_office_id UUID;
BEGIN
  FOR v_office_id IN
    SELECT DISTINCT office_id FROM public.audit_logs_default
  LOOP
    PERFORM create_office_partition('audit_logs', v_office_id);
    INSERT INTO public.audit_logs
    SELECT * FROM public.audit_logs_default WHERE office_id = v_office_id;
    DELETE FROM public.audit_logs_default WHERE office_id = v_office_id;
  END LOOP;
END $$;

DO $$
DECLARE
  v_office_id UUID;
BEGIN
  FOR v_office_id IN
    SELECT DISTINCT office_id FROM public.attachments_default
  LOOP
    PERFORM create_office_partition('attachments', v_office_id);
    INSERT INTO public.attachments
    SELECT * FROM public.attachments_default WHERE office_id = v_office_id;
    DELETE FROM public.attachments_default WHERE office_id = v_office_id;
  END LOOP;
END $$;

-- =====================================================
-- 10. DROP OLD TABLES (after verifying data migration)
-- =====================================================

-- Drop old tables now that data is migrated
DROP TABLE IF EXISTS public.messages_old CASCADE;
DROP TABLE IF EXISTS public.audit_logs_old CASCADE;
DROP TABLE IF EXISTS public.attachments_old CASCADE;

-- =====================================================
-- 11. LOG THE MIGRATION
-- =====================================================

DO $$
BEGIN
  INSERT INTO public.audit_logs (
    office_id,
    actor_id,
    action,
    entity_type,
    metadata,
    created_at
  )
  SELECT
    id,
    NULL,
    'update'::audit_action,
    'database_migration',
    jsonb_build_object(
      'migration', '20241217000001_partition_tables_uuid_v7',
      'changes', ARRAY[
        'Added uuid_generate_v7() function for time-ordered UUIDs',
        'Converted messages table to list-partitioned by office_id',
        'Converted audit_logs table to list-partitioned by office_id',
        'Converted attachments table to list-partitioned by office_id',
        'Added auto-partition creation trigger for new offices',
        'Created office-specific partitions for existing offices'
      ],
      'benefits', ARRAY[
        'UUID v7 reduces B-tree index fragmentation on inserts',
        'List partitioning enables partition pruning for office-scoped queries',
        'Per-office partitions allow for easier data lifecycle management',
        'Improved write performance at scale (10TB+)'
      ]
    ),
    NOW()
  FROM public.offices
  LIMIT 1;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors in audit logging (may fail if no offices exist)
  NULL;
END $$;

-- =====================================================
-- IMPORTANT NOTES FOR OPERATIONS
-- =====================================================
--
-- 1. New UUIDs: All new records in messages, audit_logs, and attachments
--    will use UUID v7 (time-ordered). Existing UUIDs are preserved.
--
-- 2. Partition Management: New offices automatically get partitions via trigger.
--    Use create_office_partition() to manually create partitions if needed.
--
-- 3. Foreign Keys: Due to PostgreSQL limitations with partitioned tables:
--    - message_recipients.message_id FK was dropped (app validates)
--    - bulk_response_log.generated_message_id FK was dropped (app validates)
--
-- 4. Query Performance: Always include office_id in WHERE clauses for
--    partition pruning. Example:
--    SELECT * FROM messages WHERE office_id = 'xxx' AND id = 'yyy'
--
-- 5. Data Archival: Individual office partitions can be detached and
--    archived independently without affecting other offices.
--
