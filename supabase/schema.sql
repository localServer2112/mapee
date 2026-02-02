-- Mapee Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ping logs table - stores individual network test results
CREATE TABLE IF NOT EXISTS ping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED,
  reported_isp VARCHAR(100) NOT NULL,
  verified_asn VARCHAR(100),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  jitter INTEGER NOT NULL CHECK (jitter >= 0),
  upload_speed DECIMAL(10, 2) NOT NULL CHECK (upload_speed >= 0),
  download_speed DECIMAL(10, 2) NOT NULL CHECK (download_speed >= 0),
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for common queries
  CONSTRAINT valid_lat CHECK (lat >= -90 AND lat <= 90),
  CONSTRAINT valid_lng CHECK (lng >= -180 AND lng <= 180)
);

-- Create spatial index for geographic queries
CREATE INDEX IF NOT EXISTS idx_ping_logs_location ON ping_logs USING GIST (location);

-- Create index for time-based queries
CREATE INDEX IF NOT EXISTS idx_ping_logs_created_at ON ping_logs (created_at DESC);

-- Create index for ISP filtering
CREATE INDEX IF NOT EXISTS idx_ping_logs_isp ON ping_logs (reported_isp);

-- Aggregated hexbin statistics (materialized view for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS hexbin_stats AS
WITH hex_grid AS (
  SELECT
    -- Generate hexbin ID based on coordinates (500m grid)
    CONCAT(
      FLOOR(lat / 0.0045)::text, '_',
      FLOOR(lng / 0.005)::text
    ) as hex_id,
    FLOOR(lat / 0.0045) * 0.0045 + 0.00225 as center_lat,
    FLOOR(lng / 0.005) * 0.005 + 0.0025 as center_lng,
    lat,
    lng,
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
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY hexbin_stats;
END;
$$ LANGUAGE plpgsql;

-- ISP rankings view
CREATE OR REPLACE VIEW isp_rankings AS
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

-- Function to get pings within a bounding box
CREATE OR REPLACE FUNCTION get_pings_in_bounds(
  north DOUBLE PRECISION,
  south DOUBLE PRECISION,
  east DOUBLE PRECISION,
  west DOUBLE PRECISION,
  max_age_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  reported_isp VARCHAR,
  verified_asn VARCHAR,
  latency_ms INTEGER,
  jitter INTEGER,
  upload_speed DECIMAL,
  download_speed DECIMAL,
  device_type VARCHAR,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.lat,
    p.lng,
    p.reported_isp,
    p.verified_asn,
    p.latency_ms,
    p.jitter,
    p.upload_speed,
    p.download_speed,
    p.device_type,
    p.created_at
  FROM ping_logs p
  WHERE p.lat BETWEEN south AND north
    AND p.lng BETWEEN west AND east
    AND p.created_at > NOW() - (max_age_days || ' days')::INTERVAL
  ORDER BY p.created_at DESC
  LIMIT 1000;
END;
$$ LANGUAGE plpgsql;

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
) AS $$
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
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE ping_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (anonymous submissions)
CREATE POLICY "Allow anonymous inserts" ON ping_logs
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read
CREATE POLICY "Allow public read" ON ping_logs
  FOR SELECT USING (true);

-- Prevent updates and deletes (immutable logs)
CREATE POLICY "Prevent updates" ON ping_logs
  FOR UPDATE USING (false);

CREATE POLICY "Prevent deletes" ON ping_logs
  FOR DELETE USING (false);

-- Grant permissions
GRANT SELECT, INSERT ON ping_logs TO anon;
GRANT SELECT ON hexbin_stats TO anon;
GRANT SELECT ON isp_rankings TO anon;
GRANT EXECUTE ON FUNCTION get_pings_in_bounds TO anon;
GRANT EXECUTE ON FUNCTION get_hexbin_stats_in_bounds TO anon;
