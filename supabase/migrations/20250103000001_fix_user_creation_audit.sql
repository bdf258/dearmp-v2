-- Migration: Fix user creation audit trigger
-- Issue: audit_user_lifecycle function fails when office_id is NULL
-- This happens because handle_new_user creates profiles with NULL office_id
-- but audit_logs.office_id is NOT NULL
--
-- Fix: Skip audit logging when office_id is NULL (user has not yet been assigned to an office)

CREATE OR REPLACE FUNCTION public.audit_user_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Skip audit if office_id is NULL (user not yet assigned to an office)
    -- This happens during initial user creation before they claim an invitation
    IF NEW.office_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'user_create',
      'profile',
      NEW.id,
      jsonb_build_object(
        'new_user_name', NEW.full_name,
        'new_user_email', NEW.id::text,
        'role', NEW.role
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Skip audit if office_id is NULL
    IF OLD.office_id IS NULL THEN
      RETURN OLD;
    END IF;

    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      OLD.office_id,
      auth.uid(),
      'user_delete',
      'profile',
      OLD.id,
      jsonb_build_object(
        'deleted_user_name', OLD.full_name,
        'deleted_user_role', OLD.role
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Also add an audit trigger for when a user is assigned to an office
-- This way we still get an audit log entry when the user joins an office
CREATE OR REPLACE FUNCTION public.audit_user_office_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only trigger when office_id changes from NULL to a value
  IF OLD.office_id IS NULL AND NEW.office_id IS NOT NULL THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'user_create',
      'profile',
      NEW.id,
      jsonb_build_object(
        'user_name', NEW.full_name,
        'role', NEW.role,
        'assigned_from', 'invitation'
      )
    );
  -- Also log when office_id changes between offices (edge case)
  ELSIF OLD.office_id IS NOT NULL AND NEW.office_id IS NOT NULL AND OLD.office_id != NEW.office_id THEN
    INSERT INTO audit_logs (
      office_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.office_id,
      auth.uid(),
      'update',
      'profile',
      NEW.id,
      jsonb_build_object(
        'user_name', NEW.full_name,
        'role', NEW.role,
        'previous_office_id', OLD.office_id,
        'new_office_id', NEW.office_id
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for office assignment
DROP TRIGGER IF EXISTS user_office_assignment_audit_trigger ON profiles;
CREATE TRIGGER user_office_assignment_audit_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.office_id IS DISTINCT FROM NEW.office_id)
  EXECUTE FUNCTION audit_user_office_assignment();

-- Add comment for documentation
COMMENT ON FUNCTION audit_user_lifecycle IS
  'Audits user lifecycle events (create/delete). Skips audit when office_id is NULL to allow user creation before office assignment.';
COMMENT ON FUNCTION audit_user_office_assignment IS
  'Audits when a user is assigned to an office (office_id changes from NULL to a value).';
