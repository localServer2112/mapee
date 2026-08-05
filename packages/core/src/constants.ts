// Domain constants. Client-specific config (storage keys, map defaults, API
// route paths) belongs to the client, not here.
//
// Per the rewrite plan §7.1 these become server-owned and are served from
// /v1/config so they can be tuned without shipping a new mobile binary. Until
// that endpoint exists they are compiled in.

export const ISP_LIST = [
  "MTN Nigeria",
  "Airtel Nigeria",
  "Globacom (Glo)",
  "9mobile",
  "Spectranet",
  "Swift Networks",
  "ipNX",
  "Starlink Nigeria",
  "Tizeti (wifi.com.ng)",
  "Cyberspace",
  "MainOne",
  "Coollink",
  "Ngcom",
  "Other",
] as const;

export type ISPName = (typeof ISP_LIST)[number];

export const LATENCY_THRESHOLDS = {
  GOOD: 50, // ms - anything under is "good"
  FAIR: 150, // ms - anything under is "fair", above is "poor"
};

export const DATA_FRESHNESS = {
  FRESH_DAYS: 7, // Full weight (1.0)
  STALE_DAYS: 30, // Reduced weight (0.5)
  EXPIRED_DAYS: 30, // Ignored (0)
};

/**
 * Aggregation grid cell size, in degrees.
 *
 * These MUST stay in sync with the hexbin_stats materialized view in
 * supabase/schema.sql, which buckets by FLOOR(lat_grid / 0.0045) and
 * FLOOR(lng_grid / 0.005). The server is the single source of truth for
 * aggregation; clients only need these to interpret returned cell centres.
 */
export const GRID = {
  LAT_STEP: 0.0045,
  LNG_STEP: 0.005,
};

export const TEST_ENDPOINTS = {
  PING_URL: "https://www.google.com/favicon.ico",
  BACKUP_URL: "https://www.cloudflare.com/favicon.ico",
};
