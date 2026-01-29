"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import { PingLog, PingLogState, PingLogAction, HexBin, CellTower } from "@/types";
import { STORAGE_KEYS } from "@/lib/constants";

const initialState: PingLogState = {
  logs: [],
  pendingSync: [],
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
    case "ADD_LOG":
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

    case "SYNC_COMPLETE":
      return {
        ...state,
        pendingSync: state.pendingSync.filter(
          (log) => !action.payload.includes(log.id)
        ),
      };

    case "LOAD_CACHED":
      return {
        ...state,
        logs: action.payload,
      };

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

// Context
const PingLogContext = createContext<{
  state: PingLogState;
  dispatch: React.Dispatch<PingLogAction>;
  addPingLog: (log: PingLog) => void;
  selectHexbin: (hexbin: HexBin | null) => void;
  toggleTowers: () => void;
  setTowers: (towers: CellTower[]) => void;
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
      // Merge pending sync with logs
      dispatch({ type: "LOAD_CACHED", payload: [...(cachedLogs || []), ...pendingSync] });
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

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      dispatch({ type: "SET_ONLINE", payload: true });
      // TODO: Sync pending logs when back online
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
  }, []);

  // Helper functions
  const addPingLog = (log: PingLog) => {
    dispatch({ type: "ADD_LOG", payload: log });
  };

  const selectHexbin = (hexbin: HexBin | null) => {
    dispatch({ type: "SELECT_HEXBIN", payload: hexbin });
  };

  const toggleTowers = () => {
    dispatch({ type: "TOGGLE_TOWERS" });
  };

  const setTowers = (towers: CellTower[]) => {
    dispatch({ type: "SET_TOWERS", payload: towers });
  };

  return (
    <PingLogContext.Provider
      value={{
        state,
        dispatch,
        addPingLog,
        selectHexbin,
        toggleTowers,
        setTowers,
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
