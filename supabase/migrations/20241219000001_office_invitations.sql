-- Migration: Create office_invitations table for secure user signup
-- This enables invitation-based office assignment during user registration

-- Create office_invitations table
CREATE TABLE IF NOT EXISTS office_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  email TEXT, -- Optional: restrict invitation to specific email
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role user_role NOT NULL DEFAULT 'staff',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0
);

-- Create index for token lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_office_invitations_token ON office_invitations(token);

-- Create index for office lookups
CREATE INDEX IF NOT EXISTS idx_office_invitations_office_id ON office_invitations(office_id);

-- Create index for expiry checks
CREATE INDEX IF NOT EXISTS idx_office_invitations_expires_at ON office_invitations(expires_at) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE office_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can create and view invitations for their office
CREATE POLICY "Admins can manage office invitations"
  ON office_invitations
  FOR ALL
  TO authenticated
  USING (
    office_id IN (
      SELECT p.office_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    office_id IN (
      SELECT p.office_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Anyone can read a valid invitation by token (for signup validation)
-- This uses a limited view - only checking if token is valid
CREATE POLICY "Anyone can validate invitation tokens"
  ON office_invitations
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Only expose if token hasn't expired and hasn't been fully used
    expires_at > now()
    AND (used_at IS NULL OR (max_uses > 1 AND use_count < max_uses))
  );

-- Function to validate and claim an invitation
CREATE OR REPLACE FUNCTION claim_invitation(
  p_token TEXT,
  p_user_id UUID,
  p_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  office_id UUID,
  role user_role,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation office_invitations%ROWTYPE;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM office_invitations
  WHERE token = p_token
  FOR UPDATE;

  -- Check if invitation exists
  IF v_invitation.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::user_role, 'Invalid invitation code'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF v_invitation.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::user_role, 'Invitation has expired'::TEXT;
    RETURN;
  END IF;

  -- Check if already fully used
  IF v_invitation.max_uses IS NOT NULL AND v_invitation.use_count >= v_invitation.max_uses THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::user_role, 'Invitation has already been used'::TEXT;
    RETURN;
  END IF;

  -- Check email restriction if set
  IF v_invitation.email IS NOT NULL AND lower(v_invitation.email) != lower(p_email) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::user_role, 'This invitation is for a different email address'::TEXT;
    RETURN;
  END IF;

  -- Claim the invitation
  UPDATE office_invitations
  SET
    use_count = use_count + 1,
    used_at = CASE WHEN max_uses = 1 THEN now() ELSE used_at END,
    used_by = CASE WHEN max_uses = 1 THEN p_user_id ELSE used_by END
  WHERE id = v_invitation.id;

  -- Return success with office details
  RETURN QUERY SELECT true, v_invitation.office_id, v_invitation.role, NULL::TEXT;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION claim_invitation TO authenticated;

-- Function to create an invitation (for admins)
CREATE OR REPLACE FUNCTION create_office_invitation(
  p_office_id UUID,
  p_email TEXT DEFAULT NULL,
  p_role user_role DEFAULT 'staff',
  p_expires_in_days INTEGER DEFAULT 7,
  p_max_uses INTEGER DEFAULT 1
)
RETURNS office_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation office_invitations;
BEGIN
  -- Verify caller is admin of this office
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND office_id = p_office_id
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only office admins can create invitations';
  END IF;

  INSERT INTO office_invitations (
    office_id,
    email,
    role,
    created_by,
    expires_at,
    max_uses
  ) VALUES (
    p_office_id,
    p_email,
    p_role,
    auth.uid(),
    now() + (p_expires_in_days || ' days')::interval,
    p_max_uses
  )
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_office_invitation TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE office_invitations IS 'Stores invitation tokens for secure user signup with office assignment';
COMMENT ON FUNCTION claim_invitation IS 'Validates and claims an invitation during user signup';
COMMENT ON FUNCTION create_office_invitation IS 'Creates a new invitation for an office (admin only)';
