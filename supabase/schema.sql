-- Mapee Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable PostGIS extension in a dedicated schema (not public)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Fix PostGIS system table: take ownership then enable RLS
ALTER TABLE IF EXISTS public.spatial_ref_sys OWNER TO postgres;
ALTER TABLE IF EXISTS public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Installs table - anonymous per-device identity for write auth, rate
-- limiting, and own-data access (plan §7.6). Not a user account: no PII, no
-- sign-up. Stores a hash of the opaque token, never the token itself, same
-- reasoning as password storage -- a DB leak shouldn't yield usable tokens.
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
-- never a direct client-to-Supabase call like ping_logs' anonymous insert
-- below. Default-deny for anon/authenticated.
ALTER TABLE installs ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS policies, but RLS bypass is separate from base
-- table grants -- without this, every installs query from apps/api fails
-- with "permission denied for table installs" even though the role can see
-- past RLS. Confirmed by actually applying this to a real database.
GRANT SELECT, INSERT, UPDATE ON installs TO service_role;

-- Ping logs table - stores individual network test results
-- Exact coordinates are AES-256-GCM encrypted; grid coordinates (~500m) used for spatial queries
CREATE TABLE IF NOT EXISTS ping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_encrypted TEXT NOT NULL,
  lng_encrypted TEXT NOT NULL,
  lat_grid DOUBLE PRECISION NOT NULL,
  lng_grid DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng_grid, lat_grid), 4326)::geography
  ) STORED,
  reported_isp VARCHAR(100) NOT NULL,
  verified_asn VARCHAR(100),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  jitter INTEGER NOT NULL CHECK (jitter >= 0),
  upload_speed DECIMAL(10, 2) NOT NULL CHECK (upload_speed >= 0),
  download_speed DECIMAL(10, 2) NOT NULL CHECK (download_speed >= 0),
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  user_agent TEXT,
  -- 'heuristic': speed derived from a latency-based formula, not measured
  -- (see src/lib/speedtest.ts and rewrite plan §6.2/§7.5 item 2). 'measured'
  -- is reserved for a real throughput test. Set from the client's own
  -- ThroughputResult outcome (Track B Phase 3) via POST /v1/scans -- trusted
  -- client-declared for now, same trust boundary as every other submitted
  -- field; isp_rankings below filters to 'measured' only.
  measurement_method VARCHAR(20) NOT NULL DEFAULT 'heuristic'
    CHECK (measurement_method IN ('heuristic', 'measured')),
  -- Nullable: who submitted this (plan §7.5 item 1's ownership restriction
  -- on exact coordinates) and radio metadata (§7.5 item 3, mostly
  -- Android -- mapee_radio's iOS carrier/RAT access is far more limited).
  -- ON DELETE SET NULL, not CASCADE: deleting an install must not delete the
  -- anonymized aggregate-contributing scan data it submitted.
  owner_install_id UUID REFERENCES installs(id) ON DELETE SET NULL,
  radio_type VARCHAR(10),
  signal_dbm INTEGER,
  mcc VARCHAR(10),
  mnc VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_lat_grid CHECK (lat_grid >= -90 AND lat_grid <= 90),
  CONSTRAINT valid_lng_grid CHECK (lng_grid >= -180 AND lng_grid <= 180)
);

CREATE INDEX IF NOT EXISTS idx_ping_logs_owner_install_id ON ping_logs (owner_install_id);

-- Create spatial index for geographic queries
CREATE INDEX IF NOT EXISTS idx_ping_logs_location ON ping_logs USING GIST (location);

-- Create index for time-based queries
CREATE INDEX IF NOT EXISTS idx_ping_logs_created_at ON ping_logs (created_at DESC);

-- Create index for ISP filtering
CREATE INDEX IF NOT EXISTS idx_ping_logs_isp ON ping_logs (reported_isp);

-- Create composite index for bounding-box queries on grid coordinates
CREATE INDEX IF NOT EXISTS idx_ping_logs_grid ON ping_logs (lat_grid, lng_grid);

-- Aggregated hexbin statistics (materialized view for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS hexbin_stats AS
WITH hex_grid AS (
  SELECT
    -- Generate hexbin ID based on grid coordinates (500m grid)
    CONCAT(
      FLOOR(lat_grid / 0.0045)::text, '_',
      FLOOR(lng_grid / 0.005)::text
    ) as hex_id,
    FLOOR(lat_grid / 0.0045) * 0.0045 + 0.00225 as center_lat,
    FLOOR(lng_grid / 0.005) * 0.005 + 0.0025 as center_lng,
    lat_grid,
    lng_grid,
    reported_isp,
    latency_ms,
    jitter,
    created_at
  FROM ping_logs
  WHERE created_at > NOW() - INTERVAL '30 days'
)
SELECT
  hex_id,
  center_lat,
  center_lng,
  AVG(latency_ms)::INTEGER as avg_latency,
  MIN(latency_ms) as min_latency,
  MAX(latency_ms) as max_latency,
  COUNT(*)::INTEGER as ping_count,
  MODE() WITHIN GROUP (ORDER BY reported_isp) as top_isp,
  -- Confidence score: higher with more samples, adjusted for recency
  LEAST(100, (COUNT(*) * 10 +
    SUM(CASE
      WHEN created_at > NOW() - INTERVAL '7 days' THEN 5
      WHEN created_at > NOW() - INTERVAL '14 days' THEN 3
      ELSE 1
    END)
  ))::INTEGER as confidence_score,
  -- Consistency: % of pings under 100ms
  (COUNT(*) FILTER (WHERE latency_ms <= 100) * 100.0 / NULLIF(COUNT(*), 0))::INTEGER as consistency,
  MAX(created_at) as last_updated
FROM hex_grid
GROUP BY hex_id, center_lat, center_lng
HAVING COUNT(*) >= 1;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_hexbin_stats_id ON hexbin_stats (hex_id);
CREATE INDEX IF NOT EXISTS idx_hexbin_stats_location ON hexbin_stats (center_lat, center_lng);

-- Function to refresh hexbin stats (call periodically)
CREATE OR REPLACE FUNCTION refresh_hexbin_stats()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY hexbin_stats;
END;
$$;

-- ISP rankings view (SECURITY INVOKER so it runs with caller's permissions)
-- Restricted to measurement_method = 'measured' -- see the column comment on
-- ping_logs. Returns no rows until a client can perform a real throughput
-- test; this is intentional, not a bug to "fix" by loosening the filter.
CREATE OR REPLACE VIEW isp_rankings WITH (security_invoker = true) AS
SELECT
  reported_isp as isp,
  AVG(latency_ms)::INTEGER as avg_latency,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)::INTEGER as median_latency,
  AVG(jitter)::INTEGER as avg_jitter,
  COUNT(*)::INTEGER as sample_count,
  AVG(download_speed)::DECIMAL(10, 2) as avg_download,
  AVG(upload_speed)::DECIMAL(10, 2) as avg_upload
FROM ping_logs
WHERE created_at > NOW() - INTERVAL '30 days'
  AND measurement_method = 'measured'
GROUP BY reported_isp
ORDER BY median_latency ASC;

-- Function to get pings within a bounding box (uses grid coords for spatial filter)
CREATE OR REPLACE FUNCTION get_pings_in_bounds(
  north DOUBLE PRECISION,
  south DOUBLE PRECISION,
  east DOUBLE PRECISION,
  west DOUBLE PRECISION,
  max_age_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  lat_encrypted TEXT,
  lng_encrypted TEXT,
  lat_grid DOUBLE PRECISION,
  lng_grid DOUBLE PRECISION,
  reported_isp VARCHAR,
  verified_asn VARCHAR,
  latency_ms INTEGER,
  jitter INTEGER,
  upload_speed DECIMAL,
  download_speed DECIMAL,
  device_type VARCHAR,
  measurement_method VARCHAR,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.lat_encrypted,
    p.lng_encrypted,
    p.lat_grid,
    p.lng_grid,
    p.reported_isp,
    p.verified_asn,
    p.latency_ms,
    p.jitter,
    p.upload_speed,
    p.download_speed,
    p.device_type,
    p.measurement_method,
    p.created_at
  FROM ping_logs p
  WHERE p.lat_grid BETWEEN south AND north
    AND p.lng_grid BETWEEN west AND east
    AND p.created_at > NOW() - (max_age_days || ' days')::INTERVAL
  ORDER BY p.created_at DESC
  LIMIT 1000;
END;
$$;

-- Function to get hexbin stats within bounds
CREATE OR REPLACE FUNCTION get_hexbin_stats_in_bounds(
  north DOUBLE PRECISION,
  south DOUBLE PRECISION,
  east DOUBLE PRECISION,
  west DOUBLE PRECISION
)
RETURNS TABLE (
  hex_id TEXT,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  avg_latency INTEGER,
  min_latency INTEGER,
  max_latency INTEGER,
  ping_count INTEGER,
  top_isp TEXT,
  confidence_score INTEGER,
  consistency INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.hex_id,
    h.center_lat,
    h.center_lng,
    h.avg_latency,
    h.min_latency,
    h.max_latency,
    h.ping_count,
    h.top_isp::TEXT,
    h.confidence_score,
    h.consistency
  FROM hexbin_stats h
  WHERE h.center_lat BETWEEN south AND north
    AND h.center_lng BETWEEN west AND east;
END;
$$;

-- Row Level Security (RLS) policies
--
-- Postgres has no CREATE POLICY IF NOT EXISTS -- unlike every other
-- statement in this file (CREATE TABLE/INDEX/FUNCTION/VIEW all have an
-- IF NOT EXISTS or OR REPLACE form), a bare CREATE POLICY is not
-- idempotent and errors on a second run. Found by actually re-running
-- this file against a real database, which is exactly the scenario a
-- schema file needs to survive. DROP POLICY IF EXISTS first make each
-- one safe to re-run, matching how every other object here already behaves.
ALTER TABLE ping_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (anonymous submissions)
DROP POLICY IF EXISTS "Allow anonymous inserts" ON ping_logs;
CREATE POLICY "Allow anonymous inserts" ON ping_logs
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read
DROP POLICY IF EXISTS "Allow public read" ON ping_logs;
CREATE POLICY "Allow public read" ON ping_logs
  FOR SELECT USING (true);

-- Prevent updates and deletes (immutable logs)
DROP POLICY IF EXISTS "Prevent updates" ON ping_logs;
CREATE POLICY "Prevent updates" ON ping_logs
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Prevent deletes" ON ping_logs;
CREATE POLICY "Prevent deletes" ON ping_logs
  FOR DELETE USING (false);

-- Grant permissions
GRANT SELECT, INSERT ON ping_logs TO anon;
GRANT SELECT ON hexbin_stats TO anon;
GRANT SELECT ON isp_rankings TO anon;
GRANT EXECUTE ON FUNCTION get_pings_in_bounds TO anon;
GRANT EXECUTE ON FUNCTION get_hexbin_stats_in_bounds TO anon;

-- service_role bypasses RLS policies (including "Prevent deletes" above),
-- but RLS bypass is separate from base table grants -- apps/api's
-- service-role client needs its own explicit grant for scan submission
-- (INSERT), scan detail/me-scans reads (SELECT), and delete-my-data
-- (DELETE). Confirmed by actually applying this to a real database.
GRANT SELECT, INSERT, DELETE ON ping_logs TO service_role;
