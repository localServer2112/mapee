// Domain constants (plan §2.2). Client-specific config (storage keys, map
// defaults, API route paths) belongs to the client, not here. Ported from
// packages/core/src/constants.ts — keep both in sync.

const List<String> ispList = [
  'MTN Nigeria',
  'Airtel Nigeria',
  'Globacom (Glo)',
  '9mobile',
  'Spectranet',
  'Swift Networks',
  'ipNX',
  'Starlink Nigeria',
  'Tizeti (wifi.com.ng)',
  'Cyberspace',
  'MainOne',
  'Coollink',
  'Ngcom',
  'Other',
];

class LatencyThresholds {
  const LatencyThresholds._();

  static const int good = 50;
  static const int fair = 150;
}

class DataFreshness {
  const DataFreshness._();

  static const int freshDays = 7;
  static const int staleDays = 30;
  static const int expiredDays = 30;
}

/// Aggregation grid cell size, in degrees.
///
/// These MUST stay in sync with the hexbin_stats materialized view in
/// supabase/schema.sql, which buckets by FLOOR(lat_grid / 0.0045) and
/// FLOOR(lng_grid / 0.005). The server is the single source of truth for
/// aggregation; clients only need these to interpret returned cell centres.
class Grid {
  const Grid._();

  static const double latStep = 0.0045;
  static const double lngStep = 0.005;
}

class TestEndpoints {
  const TestEndpoints._();

  static const String pingUrl = 'https://www.google.com/favicon.ico';
  static const String backupUrl = 'https://www.cloudflare.com/favicon.ico';
}
