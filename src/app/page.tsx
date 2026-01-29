"use client";

import { useState, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { usePingLogStore } from "@/stores/pingLogStore";
import { useMapBounds } from "@/hooks/useMapBounds";
import { useNearbyTowers } from "@/hooks/useNearbyTowers";
import { useOnlineStatus } from "@/hooks/useOfflineCache";
import { PingLog, HexBin, Coordinates, MapBounds, GeocodeResult } from "@/types";
import FloatingActionButton from "@/components/overlays/FloatingActionButton";
import NetworkTestFlow from "@/components/flow/NetworkTestFlow";
import AreaSummarySheet from "@/components/overlays/AreaSummarySheet";
import LocationSearch from "@/components/search/LocationSearch";
import { Button } from "@/components/ui/button";
import { Radio, Layers } from "lucide-react";

// Dynamic import for the map (SSR disabled)
const MapContainer = dynamic(
  () => import("@/components/map/MapContainer"),
  { ssr: false }
);

export default function HomePage() {
  // State
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isTestingActive, setIsTestingActive] = useState(false);

  // Map ref for flying to locations
  const mapRef = useRef<L.Map | null>(null);

  // Hooks
  const { state, addPingLog, selectHexbin, toggleTowers, setTowers } = usePingLogStore();
  const { bounds, updateBounds } = useMapBounds();
  const { fetchTowers } = useNearbyTowers();
  const isOnline = useOnlineStatus();

  // Handlers
  const handlePingSubmit = useCallback(
    (log: PingLog) => {
      addPingLog(log);
    },
    [addPingLog]
  );

  const handleHexbinClick = useCallback(
    (hexbin: HexBin) => {
      selectHexbin(hexbin);
      setIsSheetOpen(true);
    },
    [selectHexbin]
  );

  const handleSheetClose = useCallback(() => {
    setIsSheetOpen(false);
    selectHexbin(null);
  }, [selectHexbin]);

  const handleBoundsChange = useCallback(
    async (newBounds: MapBounds, center: [number, number], zoom: number) => {
      updateBounds(newBounds, center, zoom);

      // Fetch towers if enabled and zoomed in enough
      if (state.showTowers && zoom >= 10) {
        const towers = await fetchTowers(newBounds);
        setTowers(towers);
      }
    },
    [updateBounds, state.showTowers, fetchTowers, setTowers]
  );

  const handleToggleTowers = useCallback(async () => {
    toggleTowers();

    // Fetch towers if enabling and we have bounds
    if (!state.showTowers && bounds) {
      const towers = await fetchTowers(bounds);
      setTowers(towers);
    }
  }, [toggleTowers, state.showTowers, bounds, fetchTowers, setTowers]);

  const handleLocationSearch = useCallback((result: GeocodeResult) => {
    // Fly to the searched location
    // This would need map ref - for now just log
    console.log("Fly to:", result.lat, result.lng);
  }, []);

  const handleLocationChange = useCallback((coords: Coordinates | null) => {
    setUserLocation(coords);
  }, []);

  const handleTestingStateChange = useCallback((isTesting: boolean) => {
    setIsTestingActive(isTesting);
  }, []);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-slate-900">
      {/* Full-screen Map */}
      <MapContainer
        pingLogs={state.logs}
        towers={state.towers}
        showTowers={state.showTowers}
        selectedHexbin={state.selectedHexbin}
        userLocation={userLocation}
        isTestingActive={isTestingActive}
        onBoundsChange={handleBoundsChange}
        onHexbinClick={handleHexbinClick}
      />

      {/* Top overlay - Search and controls */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-start gap-3">
        {/* Search bar */}
        <LocationSearch
          onSelect={handleLocationSearch}
          className="flex-1 max-w-md"
        />

        {/* Tower toggle button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleToggleTowers}
          className={`
            bg-slate-800/80 backdrop-blur-sm border-slate-700
            ${state.showTowers ? "text-purple-400 border-purple-500" : "text-slate-400"}
          `}
        >
          <Radio className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats overlay (bottom left) */}
      <div className="absolute bottom-24 left-4 z-30">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">{state.logs.length} scans</span>
            </div>
            {!isOnline && (
              <div className="flex items-center gap-1.5 text-yellow-400">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton
        onClick={() => setIsFlowOpen(true)}
        isOnline={isOnline}
      />

      {/* Network Test Flow Modal */}
      <AnimatePresence>
        <NetworkTestFlow
          isOpen={isFlowOpen}
          onClose={() => setIsFlowOpen(false)}
          onSubmit={handlePingSubmit}
          onLocationChange={handleLocationChange}
          onTestingStateChange={handleTestingStateChange}
        />
      </AnimatePresence>

      {/* Area Summary Sheet */}
      <AreaSummarySheet
        hexbin={state.selectedHexbin}
        isOpen={isSheetOpen}
        onClose={handleSheetClose}
      />
    </main>
  );
}
