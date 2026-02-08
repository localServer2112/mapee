"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { PingLog, PingLogState, PingLogAction, HexBin, CellTower, MapBounds } from "@/types";
import { STORAGE_KEYS, API_URLS } from "@/lib/constants";

const initialState: PingLogState = {
  logs: [],
  pendingSync: [],
  myPingIds: [],
  isOnline: true,
  selectedHexbin: null,
  showTowers: false,
  towers: [],
};

function pingLogReducer(
  state: PingLogState,
  action: PingLogAction
): PingLogState {
  switch (action.type) {
    case "ADD_LOG": {
      // Prevent duplicates
      if (state.logs.some((l) => l.id === action.payload.id)) {
        return state;
      }
      const newLogs = [...state.logs, action.payload];
      // If offline, also add to pending sync queue
      const newPendingSync = state.isOnline
        ? state.pendingSync
        : [...state.pendingSync, action.payload];
      return {
        ...state,
        logs: newLogs,
        pendingSync: newPendingSync,
      };
    }

    case "SYNC_COMPLETE":
      return {
        ...state,
        pendingSync: state.pendingSync.filter(
          (log) => !action.payload.includes(log.id)
        ),
      };

    case "LOAD_CACHED": {
      // Deduplicate by ID to handle stale localStorage data
      const seen = new Set<string>();
      const dedupedLogs = action.payload.filter((log) => {
        if (seen.has(log.id)) return false;
        seen.add(log.id);
        return true;
      });
      return {
        ...state,
        logs: dedupedLogs,
      };
    }

    case "SET_ONLINE":
      return {
        ...state,
        isOnline: action.payload,
      };

    case "SELECT_HEXBIN":
      return {
        ...state,
        selectedHexbin: action.payload,
      };

    case "TOGGLE_TOWERS":
      return {
        ...state,
        showTowers: !state.showTowers,
      };

    case "SET_TOWERS":
      return {
        ...state,
        towers: action.payload,
      };

    case "ADD_MY_PING":
      if (state.myPingIds.includes(action.payload)) return state;
      return {
        ...state,
        myPingIds: [...state.myPingIds, action.payload],
      };

    case "LOAD_MY_PINGS":
      return {
        ...state,
        myPingIds: action.payload,
      };

    default:
      return state;
  }
}

// Storage helpers
function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    console.error("Error loading from storage:", key);
    return null;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.error("Error saving to storage:", key);
  }
}

// API helpers
async function syncPingToServer(log: PingLog): Promise<boolean> {
  try {
    const response = await fetch("/api/pings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    });

    if (!response.ok) {
      console.error("Failed to sync ping:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error syncing ping:", error);
    return false;
  }
}

async function fetchPingsFromServer(bounds: MapBounds): Promise<PingLog[]> {
  try {
    const params = new URLSearchParams({
      north: String(bounds.north),
      south: String(bounds.south),
      east: String(bounds.east),
      west: String(bounds.west),
      maxAge: "30",
    });

    const response = await fetch(`/api/pings?${params}`);

    if (!response.ok) {
      throw new Error("Failed to fetch pings");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching pings:", error);
    return [];
  }
}

// Context
const PingLogContext = createContext<{
  state: PingLogState;
  dispatch: React.Dispatch<PingLogAction>;
  addPingLog: (log: PingLog) => Promise<void>;
  selectHexbin: (hexbin: HexBin | null) => void;
  toggleTowers: () => void;
  setTowers: (towers: CellTower[]) => void;
  syncPendingLogs: () => Promise<void>;
  fetchLogsForBounds: (bounds: MapBounds) => Promise<void>;
} | null>(null);

// Provider component
export function PingLogProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pingLogReducer, initialState);

  // Load cached data on mount
  useEffect(() => {
    const cachedLogs = loadFromStorage<PingLog[]>(STORAGE_KEYS.PING_LOGS);
    if (cachedLogs && cachedLogs.length > 0) {
      dispatch({ type: "LOAD_CACHED", payload: cachedLogs });
    }

    const pendingSync = loadFromStorage<PingLog[]>(STORAGE_KEYS.PENDING_SYNC);
    if (pendingSync && pendingSync.length > 0) {
      // Merge pending sync with logs, deduplicating by ID
      const existingIds = new Set((cachedLogs || []).map((l) => l.id));
      const uniquePending = pendingSync.filter((l) => !existingIds.has(l.id));
      if (uniquePending.length > 0) {
        dispatch({ type: "LOAD_CACHED", payload: [...(cachedLogs || []), ...uniquePending] });
      }
    }

    const myPingIds = loadFromStorage<string[]>(STORAGE_KEYS.MY_PING_IDS);
    if (myPingIds && myPingIds.length > 0) {
      dispatch({ type: "LOAD_MY_PINGS", payload: myPingIds });
    }
  }, []);

  // Save to localStorage when logs change
  useEffect(() => {
    if (state.logs.length > 0) {
      saveToStorage(STORAGE_KEYS.PING_LOGS, state.logs);
    }
  }, [state.logs]);

  // Save pending sync separately
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PENDING_SYNC, state.pendingSync);
  }, [state.pendingSync]);

  // Save my ping IDs
  useEffect(() => {
    if (state.myPingIds.length > 0) {
      saveToStorage(STORAGE_KEYS.MY_PING_IDS, state.myPingIds);
    }
  }, [state.myPingIds]);

  // Sync pending logs to server
  const syncPendingLogs = useCallback(async () => {
    if (state.pendingSync.length === 0) return;

    const syncedIds: string[] = [];

    for (const log of state.pendingSync) {
      const success = await syncPingToServer(log);
      if (success) {
        syncedIds.push(log.id);
      }
    }

    if (syncedIds.length > 0) {
      dispatch({ type: "SYNC_COMPLETE", payload: syncedIds });
    }
  }, [state.pendingSync]);

  // Fetch logs for a bounding box from server
  const fetchLogsForBounds = useCallback(async (bounds: MapBounds) => {
    if (!state.isOnline) return;

    const serverLogs = await fetchPingsFromServer(bounds);

    // Merge with local logs (avoid duplicates)
    const existingIds = new Set(state.logs.map((l) => l.id));
    const newLogs = serverLogs.filter((l) => !existingIds.has(l.id));

    if (newLogs.length > 0) {
      // Add new logs without overwriting local state completely
      for (const log of newLogs) {
        dispatch({ type: "ADD_LOG", payload: log });
      }
    }
  }, [state.isOnline, state.logs]);

  // Online/offline detection with auto-sync
  useEffect(() => {
    const handleOnline = async () => {
      dispatch({ type: "SET_ONLINE", payload: true });
      // Automatically sync pending logs when back online
      if (state.pendingSync.length > 0) {
        console.log(`Syncing ${state.pendingSync.length} pending logs...`);
        await syncPendingLogs();
      }
    };

    const handleOffline = () => {
      dispatch({ type: "SET_ONLINE", payload: false });
    };

    // Set initial state
    dispatch({ type: "SET_ONLINE", payload: navigator.onLine });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [state.pendingSync.length, syncPendingLogs]);

  // Helper functions
  const addPingLog = useCallback(async (log: PingLog) => {
    dispatch({ type: "ADD_LOG", payload: log });
    dispatch({ type: "ADD_MY_PING", payload: log.id });

    // If online, try to sync immediately
    if (state.isOnline) {
      const success = await syncPingToServer(log);
      if (success) {
        dispatch({ type: "SYNC_COMPLETE", payload: [log.id] });
      }
    }
  }, [state.isOnline]);

  const selectHexbin = useCallback((hexbin: HexBin | null) => {
    dispatch({ type: "SELECT_HEXBIN", payload: hexbin });
  }, []);

  const toggleTowers = useCallback(() => {
    dispatch({ type: "TOGGLE_TOWERS" });
  }, []);

  const setTowers = useCallback((towers: CellTower[]) => {
    dispatch({ type: "SET_TOWERS", payload: towers });
  }, []);

  return (
    <PingLogContext.Provider
      value={{
        state,
        dispatch,
        addPingLog,
        selectHexbin,
        toggleTowers,
        setTowers,
        syncPendingLogs,
        fetchLogsForBounds,
      }}
    >
      {children}
    </PingLogContext.Provider>
  );
}

// Custom hook
export function usePingLogStore() {
  const context = useContext(PingLogContext);
  if (!context) {
    throw new Error("usePingLogStore must be used within PingLogProvider");
  }
  return context;
}
