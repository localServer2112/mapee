// Domain constants (ISP list, latency thresholds, freshness weights, grid size)
// now live in @mapee/core. Re-exported so existing `@/lib/constants` imports
// keep working; prefer importing from @mapee/core in new code.
export {
  ISP_LIST,
  LATENCY_THRESHOLDS,
  DATA_FRESHNESS,
  GRID,
  TEST_ENDPOINTS,
} from "@mapee/core";
export type { ISPName } from "@mapee/core";

// ---------------------------------------------------------------------------
// Web-client config. Not domain data — browser storage keys, Leaflet tile
// sources, and this app's own route paths. Mobile has its own equivalents.
// ---------------------------------------------------------------------------

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
