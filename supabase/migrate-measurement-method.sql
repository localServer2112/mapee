-- Migration: Add measurement_method to ping_logs
-- Run this in the Supabase SQL Editor, on any instance provisioned before
-- this column existed in schema.sql.
--
-- 'heuristic': speed derived from a latency-based formula, not measured
-- (src/lib/speedtest.ts). 'measured' is reserved for a real throughput
-- test -- no client can perform one yet as of this migration, so every
-- existing row backfills to 'heuristic', and isp_rankings (redefined below)
-- returns no rows until that changes. That is the rewrite plan's explicit
-- intent (§6.2/§7.5 item 2): never present fabricated numbers as measured
-- ISP rankings, even though it means the view goes quiet for a while.

-- Step 1: Add the column, nullable initially so existing rows don't fail.
ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS measurement_method VARCHAR(20);

-- Step 2: Backfill every existing row -- all of today's data is heuristic.
UPDATE ping_logs
SET measurement_method = 'heuristic'
WHERE measurement_method IS NULL;

-- Step 3: Now that it's backfilled, enforce NOT NULL and the value check.
ALTER TABLE ping_logs ALTER COLUMN measurement_method SET NOT NULL;
ALTER TABLE ping_logs ALTER COLUMN measurement_method SET DEFAULT 'heuristic';
ALTER TABLE ping_logs ADD CONSTRAINT ping_logs_measurement_method_check
  CHECK (measurement_method IN ('heuristic', 'measured'));

-- Step 4: Recreate get_pings_in_bounds to return the new column.
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

-- Step 5: Redefine isp_rankings to only ever aggregate measured rows.
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
