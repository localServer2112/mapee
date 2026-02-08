// Core data types for Mapee

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
}

export type DeviceType = "mobile" | "tablet" | "desktop";

export type LatencyStatus = "good" | "fair" | "poor";

export type FlowStep = "location" | "isp" | "testing" | "success";

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy: number;
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

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// State types
export interface PingLogState {
  logs: PingLog[];
  pendingSync: PingLog[];
  myPingIds: string[];
  isOnline: boolean;
  selectedHexbin: HexBin | null;
  showTowers: boolean;
  towers: CellTower[];
}

export type PingLogAction =
  | { type: "ADD_LOG"; payload: PingLog }
  | { type: "SYNC_COMPLETE"; payload: string[] }
  | { type: "LOAD_CACHED"; payload: PingLog[] }
  | { type: "SET_ONLINE"; payload: boolean }
  | { type: "SELECT_HEXBIN"; payload: HexBin | null }
  | { type: "TOGGLE_TOWERS" }
  | { type: "SET_TOWERS"; payload: CellTower[] }
  | { type: "ADD_MY_PING"; payload: string }
  | { type: "LOAD_MY_PINGS"; payload: string[] };
