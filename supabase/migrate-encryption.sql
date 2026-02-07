-- Migration: Add encrypted coordinate columns to ping_logs
-- Run this in the Supabase SQL Editor
-- This migrates from plain lat/lng to lat_encrypted/lng_encrypted + lat_grid/lng_grid

-- Step 1: Drop dependent objects that reference old lat/lng columns
DROP MATERIALIZED VIEW IF EXISTS hexbin_stats CASCADE;
DROP VIEW IF EXISTS isp_rankings CASCADE;
DROP FUNCTION IF EXISTS get_pings_in_bounds CASCADE;
DROP FUNCTION IF EXISTS get_hexbin_stats_in_bounds CASCADE;

-- Step 2: Add new columns (nullable initially so existing rows don't fail)
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS lat_encrypted TEXT;
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS lng_encrypted TEXT;
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS lat_grid DOUBLE PRECISION;
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS lng_grid DOUBLE PRECISION;

-- Step 3: Backfill new columns from existing lat/lng data
-- Store plain-text coordinates as legacy values (the app handles these gracefully)
-- Grid coordinates use the same 500m grid as the hexbin materialized view
UPDATE ping_logs
SET
  lat_encrypted = lat::text,
  lng_encrypted = lng::text,
  lat_grid = (FLOOR(lat / 0.0045) * 0.0045 + 0.00225),
  lng_grid = (FLOOR(lng / 0.005) * 0.005 + 0.0025)
WHERE lat_encrypted IS NULL;

-- Step 4: Make new columns NOT NULL now that they're backfilled
ALTER TABLE ping_logs ALTER COLUMN lat_encrypted SET NOT NULL;
ALTER TABLE ping_logs ALTER COLUMN lng_encrypted SET NOT NULL;
ALTER TABLE ping_logs ALTER COLUMN lat_grid SET NOT NULL;
ALTER TABLE ping_logs ALTER COLUMN lng_grid SET NOT NULL;

-- Step 5: Drop the old plain-text columns and generated location column
ALTER TABLE ping_logs DROP COLUMN IF EXISTS location;
ALTER TABLE ping_logs DROP COLUMN IF EXISTS lat;
ALTER TABLE ping_logs DROP COLUMN IF EXISTS lng;

-- Step 6: Recreate the generated location column from grid coordinates
ALTER TABLE ping_logs ADD COLUMN location GEOGRAPHY(POINT, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng_grid, lat_grid), 4326)::geography
  ) STORED;

-- Step 7: Create indexes
CREATE INDEX IF NOT EXISTS idx_ping_logs_grid ON ping_logs (lat_grid, lng_grid);
DROP INDEX IF EXISTS idx_ping_logs_location;
CREATE INDEX IF NOT EXISTS idx_ping_logs_location ON ping_logs USING GIST (location);

-- Step 8: Recreate hexbin_stats materialized view using new grid columns
CREATE MATERIALIZED VIEW IF NOT EXISTS hexbin_stats AS
WITH hex_grid AS (
  SELECT
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
  LEAST(100, (COUNT(*) * 10 +
    SUM(CASE
      WHEN created_at > NOW() - INTERVAL '7 days' THEN 5
      WHEN created_at > NOW() - INTERVAL '14 days' THEN 3
      ELSE 1
    END)
  ))::INTEGER as confidence_score,
  (COUNT(*) FILTER (WHERE latency_ms <= 100) * 100.0 / NULLIF(COUNT(*), 0))::INTEGER as consistency,
  MAX(created_at) as last_updated
FROM hex_grid
GROUP BY hex_id, center_lat, center_lng
HAVING COUNT(*) >= 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hexbin_stats_id ON hexbin_stats (hex_id);
CREATE INDEX IF NOT EXISTS idx_hexbin_stats_location ON hexbin_stats (center_lat, center_lng);

-- Step 9: Recreate isp_rankings view
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
GROUP BY reported_isp
ORDER BY median_latency ASC;

-- Step 10: Recreate functions with new column names
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
    p.created_at
  FROM ping_logs p
  WHERE p.lat_grid BETWEEN south AND north
    AND p.lng_grid BETWEEN west AND east
    AND p.created_at > NOW() - (max_age_days || ' days')::INTERVAL
  ORDER BY p.created_at DESC
  LIMIT 1000;
END;
$$;

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
    h.top_isp,
    h.confidence_score,
    h.consistency
  FROM hexbin_stats h
  WHERE h.center_lat BETWEEN south AND north
    AND h.center_lng BETWEEN west AND east;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_hexbin_stats()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY hexbin_stats;
END;
$$;

-- Step 11: Re-grant permissions
GRANT SELECT, INSERT ON ping_logs TO anon;
GRANT SELECT ON hexbin_stats TO anon;
GRANT SELECT ON isp_rankings TO anon;
GRANT EXECUTE ON FUNCTION get_pings_in_bounds TO anon;
GRANT EXECUTE ON FUNCTION get_hexbin_stats_in_bounds TO anon;

-- Step 12: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
