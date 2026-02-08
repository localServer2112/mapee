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

export const TEST_ENDPOINTS = {
  // Use a fast, reliable endpoint for latency testing
  // Google's favicon is small (~1KB) and highly available
  PING_URL: "https://www.google.com/favicon.ico",
  // Backup endpoint
  BACKUP_URL: "https://www.cloudflare.com/favicon.ico",
};

export const LATENCY_THRESHOLDS = {
  GOOD: 50, // ms - anything under is "good"
  FAIR: 150, // ms - anything under is "fair", above is "poor"
};

export const DATA_FRESHNESS = {
  FRESH_DAYS: 7, // Full weight (1.0)
  STALE_DAYS: 30, // Reduced weight (0.5)
  EXPIRED_DAYS: 30, // Ignored (0)
};

export const STORAGE_KEYS = {
  PING_LOGS: "mapee-ping-logs",
  PENDING_SYNC: "mapee-pending-sync",
  MY_PING_IDS: "mapee-my-ping-ids",
  USER_PREFERENCES: "mapee-preferences",
};

export const MAP_CONFIG = {
  DEFAULT_CENTER: [9.0820, 8.6753] as [number, number], // Center of Nigeria
  DEFAULT_ZOOM: 4,
  MIN_ZOOM: 3,
  MAX_ZOOM: 18,
  // CartoDB Dark Matter for dark mode
  DARK_TILE_URL:
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  DARK_TILE_ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  // Standard OSM for light mode
  LIGHT_TILE_URL: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  LIGHT_TILE_ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

export const HEXBIN_CONFIG = {
  RADIUS: 0.005, // ~500m at equator in degrees
  MIN_PINGS_FOR_DISPLAY: 1,
};

export const API_URLS = {
  GEOCODE: "/api/geocode",
  TOWERS: "/api/towers",
  ASN: "/api/asn",
  PINGS: "/api/pings",
  STATS: "/api/stats",
};
