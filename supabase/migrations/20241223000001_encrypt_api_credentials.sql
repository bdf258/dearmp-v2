-- ============================================================================
-- ENCRYPT API CREDENTIALS MIGRATION
-- Adds proper encryption for legacy API credentials using pgcrypto
--
-- SECURITY: Uses PGP symmetric encryption with a key from config variable
-- The encryption key must be set via: ALTER DATABASE ... SET app.encryption_key = '...'
-- or via PGOPTIONS environment variable
-- ============================================================================

-- Ensure pgcrypto is enabled (should already be from security_hardening)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENCRYPTION HELPER FUNCTIONS
-- ============================================================================

-- Get the encryption key from database config (set via environment/config)
CREATE OR REPLACE FUNCTION legacy.get_encryption_key()
RETURNS TEXT AS $$
DECLARE
  key TEXT;
BEGIN
  key := current_setting('app.encryption_key', true);
  IF key IS NULL OR key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key in database config.';
  END IF;
  RETURN key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Encrypt a value using PGP symmetric encryption
CREATE OR REPLACE FUNCTION legacy.encrypt_value(plaintext TEXT)
RETURNS TEXT AS $$
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;
  RETURN encode(
    pgp_sym_encrypt(plaintext, legacy.get_encryption_key(), 'compress-algo=2, cipher-algo=aes256'),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt a value using PGP symmetric encryption
CREATE OR REPLACE FUNCTION legacy.decrypt_value(ciphertext TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(
    decode(ciphertext, 'base64'),
    legacy.get_encryption_key()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL if decryption fails (wrong key, corrupt data, etc.)
    RAISE WARNING 'Decryption failed for credential: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC FUNCTIONS FOR CREDENTIAL MANAGEMENT
-- These are called by the server to securely store/retrieve credentials
-- ============================================================================

-- Store encrypted credentials for an office
CREATE OR REPLACE FUNCTION legacy.store_api_credentials(
  p_office_id UUID,
  p_api_base_url TEXT,
  p_email TEXT,
  p_password TEXT,
  p_token TEXT DEFAULT NULL,
  p_token_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO legacy.api_credentials (
    office_id,
    api_base_url,
    encrypted_email,
    encrypted_password,
    encrypted_token,
    token_expires_at,
    is_active
  ) VALUES (
    p_office_id,
    p_api_base_url,
    legacy.encrypt_value(p_email),
    legacy.encrypt_value(p_password),
    legacy.encrypt_value(p_token),
    p_token_expires_at,
    true
  )
  ON CONFLICT (office_id) DO UPDATE SET
    api_base_url = EXCLUDED.api_base_url,
    encrypted_email = EXCLUDED.encrypted_email,
    encrypted_password = EXCLUDED.encrypted_password,
    encrypted_token = COALESCE(EXCLUDED.encrypted_token, legacy.api_credentials.encrypted_token),
    token_expires_at = COALESCE(EXCLUDED.token_expires_at, legacy.api_credentials.token_expires_at),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get decrypted credentials for an office
CREATE OR REPLACE FUNCTION legacy.get_api_credentials(p_office_id UUID)
RETURNS TABLE (
  id UUID,
  office_id UUID,
  api_base_url TEXT,
  email TEXT,
  password TEXT,
  token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN,
  last_auth_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.office_id,
    ac.api_base_url,
    legacy.decrypt_value(ac.encrypted_email) AS email,
    legacy.decrypt_value(ac.encrypted_password) AS password,
    legacy.decrypt_value(ac.encrypted_token) AS token,
    ac.token_expires_at,
    ac.is_active,
    ac.last_auth_at
  FROM legacy.api_credentials ac
  WHERE ac.office_id = p_office_id
    AND ac.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update just the token (called after authentication)
CREATE OR REPLACE FUNCTION legacy.update_api_token(
  p_office_id UUID,
  p_token TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  UPDATE legacy.api_credentials
  SET
    encrypted_token = legacy.encrypt_value(p_token),
    token_expires_at = p_expires_at,
    last_auth_at = NOW(),
    updated_at = NOW()
  WHERE office_id = p_office_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURITY: Revoke direct table access, force use of RPC functions
-- ============================================================================

-- Only service_role can call these functions
REVOKE ALL ON FUNCTION legacy.encrypt_value(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION legacy.decrypt_value(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION legacy.get_encryption_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION legacy.store_api_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION legacy.get_api_credentials(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION legacy.update_api_token(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION legacy.store_api_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION legacy.get_api_credentials(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION legacy.update_api_token(UUID, TEXT, TIMESTAMPTZ) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION legacy.encrypt_value IS 'Encrypts a plaintext value using AES-256 PGP symmetric encryption';
COMMENT ON FUNCTION legacy.decrypt_value IS 'Decrypts a ciphertext value encrypted with encrypt_value()';
COMMENT ON FUNCTION legacy.store_api_credentials IS 'Securely stores encrypted API credentials for an office';
COMMENT ON FUNCTION legacy.get_api_credentials IS 'Retrieves and decrypts API credentials for an office';
COMMENT ON FUNCTION legacy.update_api_token IS 'Updates the encrypted JWT token after authentication';
