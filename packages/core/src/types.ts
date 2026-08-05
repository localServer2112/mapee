// Domain entities shared across every Mapee client and the API.
//
// Nothing here may reference a browser, React, or server API — this module is
// consumed by the web app, the API service, and (once ported to Dart) mobile.
// Client-local state shapes live with their client, not here.

export type DeviceType = "mobile" | "tablet" | "desktop";

export type LatencyStatus = "good" | "fair" | "poor";

/** How a scan's throughput figures were produced. */
export type MeasurementMethod = "heuristic" | "measured";

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface PingLog {
  id: string;
  lat: number;
  lng: number;
  reportedISP: string;
  verifiedASN: string | null;
  latencyMs: number;
  jitter: number;
  uploadSpeed: number; // Mbps
  downloadSpeed: number; // Mbps
  timestamp: number;
  deviceType: DeviceType;
  userAgent: string;
  isLocationExact?: boolean;
}

export interface NetworkTestResult {
  latencyMs: number;
  jitter: number;
  uploadSpeed: number; // Mbps
  downloadSpeed: number; // Mbps
  success: boolean;
  timestamp: number;
  samples: number[];
}

export interface CellTower {
  id: string;
  lat: number;
  lng: number;
  type: "4G" | "5G";
  mcc: number;
  mnc: number;
  lac: number;
  cellId: number;
}

export interface HexBin {
  x: number;
  y: number;
  centerLat: number;
  centerLng: number;
  pings: PingLog[];
  avgLatency: number;
  confidence: number;
  topISP: string;
  consistency: number;
}

export interface ASNInfo {
  isp: string;
  as: string;
  asname: string;
  org: string;
}

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
  boundingBox?: [number, number, number, number];
}
