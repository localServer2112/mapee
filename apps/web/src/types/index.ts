// Domain entities now live in @mapee/core so the API service and the Flutter
// port share one definition. Re-exported here so existing `@/types` imports
// keep working; prefer importing from @mapee/core in new code.
export type {
  DeviceType,
  LatencyStatus,
  MeasurementMethod,
  Coordinates,
  MapBounds,
  PingLog,
  NetworkTestResult,
  CellTower,
  HexBin,
  ASNInfo,
  GeocodeResult,
} from "@mapee/core";

import type { PingLog, HexBin, CellTower } from "@mapee/core";

// ---------------------------------------------------------------------------
// Web-client state. Deliberately NOT in @mapee/core: these describe this app's
// reducer, not the domain. Mobile uses Riverpod providers over the same
// entities instead.
// ---------------------------------------------------------------------------

export type FlowStep = "location" | "isp" | "testing" | "success";

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
