-- Migration: Add installs table + ownership/radio columns to ping_logs
-- Run this in the Supabase SQL Editor, on any instance provisioned before
-- these existed in schema.sql. Track A A4 (plan §7.5 items 1/3, §7.6).

-- Step 1: Installs table -- anonymous per-device identity for write auth,
-- rate limiting, and own-data access. Not a user account: no PII, no
-- sign-up. Stores a hash of the opaque token, never the token itself.
CREATE TABLE IF NOT EXISTS installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installs_token_hash ON installs (token_hash);

-- No RLS policies granting anon anything here deliberately: token issuance
-- and verification are server-side operations using the service-role key,
-- never a direct client-to-Supabase call.
ALTER TABLE installs ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS policies, but RLS bypass is separate from base
-- table grants -- without this, every installs query from apps/api fails
-- with "permission denied for table installs" even though the role can see
-- past RLS. Confirmed by actually applying this to a real database.
GRANT SELECT, INSERT, UPDATE ON installs TO service_role;

-- Step 2: New nullable columns on ping_logs. Nullable so existing rows
-- don't fail -- no backfill needed, unlike measurement_method, since there
-- is no honest value to backfill ownership or radio data to.
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS owner_install_id UUID REFERENCES installs(id) ON DELETE SET NULL;
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS radio_type VARCHAR(10);
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS signal_dbm INTEGER;
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS mcc VARCHAR(10);
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS mnc VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_ping_logs_owner_install_id ON ping_logs (owner_install_id);
