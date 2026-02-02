"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import HeaderBar from "@/components/layout/HeaderBar";
import { Button } from "@/components/ui/button";
import { Radio, Layers, Menu, X, Map as MapIcon, Activity } from "lucide-react";
import type { MapRef } from "@/components/map/MapContainer";

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
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Map ref for navigation
  const mapRef = useRef<MapRef>(null);

  // Hooks
  const { state, addPingLog, selectHexbin, toggleTowers, setTowers, fetchLogsForBounds } = usePingLogStore();
  const { bounds, updateBounds } = useMapBounds();
  const { fetchTowers } = useNearbyTowers();
  const isOnline = useOnlineStatus();

  // Fetch server data when bounds change (debounced)
  useEffect(() => {
    if (!bounds || !isOnline) return;

    const timer = setTimeout(() => {
      fetchLogsForBounds(bounds);
    }, 500);

    return () => clearTimeout(timer);
  }, [bounds, isOnline, fetchLogsForBounds]);

  // Handlers
  const handlePingSubmit = useCallback(
    async (log: PingLog) => {
      await addPingLog(log);
    },
    [addPingLog]
  );

  const handleHexbinClick = useCallback(
    (hexbin: HexBin) => {
      selectHexbin(hexbin);
      setIsSheetOpen(true);
      // On mobile, close sidebar when clicking a hexbin
      setIsMobileSidebarOpen(false);
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

  const handleToggleHeatmap = useCallback(() => {
    setShowHeatmap((prev) => !prev);
  }, []);

  const handleLocationSearch = useCallback((result: GeocodeResult) => {
    // Fly to the searched location
    if (mapRef.current) {
      if (result.boundingBox && result.boundingBox.length === 4) {
        // Use bounding box for area searches
        const [south, north, west, east] = result.boundingBox;
        mapRef.current.flyToBounds([
          [south, west],
          [north, east],
        ]);
      } else {
        // Fly to point for specific locations
        mapRef.current.flyTo(result.lat, result.lng, 14);
      }
    }
    // Close mobile sidebar after search
    setIsMobileSidebarOpen(false);
  }, []);

  const handleLocationChange = useCallback((coords: Coordinates | null) => {
    setUserLocation(coords);
    // Center map on user location
    if (coords && mapRef.current) {
      mapRef.current.flyTo(coords.lat, coords.lng, 15);
    }
  }, []);

  const handleTestingStateChange = useCallback((isTesting: boolean) => {
    setIsTestingActive(isTesting);
  }, []);

  const handleStartScan = useCallback(() => {
    setIsFlowOpen(true);
    setIsMobileSidebarOpen(false);
  }, []);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-cyber-black">
      {/* Header Bar */}
      <HeaderBar isOnline={isOnline} scanCount={state.logs.length} />

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        className="lg:hidden fixed top-14 right-4 z-30 p-2 rounded-lg bg-cyber-dark border border-cyber-border text-neon-cyan hover:bg-cyber-border transition-colors"
        aria-label={isMobileSidebarOpen ? "Close menu" : "Open menu"}
      >
        {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Main Content Area - Flex Container */}
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">

        {/* Left Side - Map (Flexible Width) */}
        <div className="flex-1 relative z-0">
          {/* Map Controls Overlay (Top Right of Map) */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleTowers}
              title={state.showTowers ? "Hide cell towers" : "Show cell towers"}
              className={`
                bg-cyber-dark border-cyber-border
                ${state.showTowers ? "text-neon-purple border-neon-purple" : "text-muted-foreground"}
                hover:border-neon-cyan hover:text-neon-cyan
              `}
            >
              <Radio className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleHeatmap}
              title={showHeatmap ? "Hide heatmap" : "Show heatmap"}
              className={`
                bg-cyber-dark border-cyber-border
                ${showHeatmap ? "text-neon-green border-neon-green" : "text-muted-foreground"}
                hover:border-neon-cyan hover:text-neon-cyan
              `}
            >
              <Layers className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile FAB for starting scan */}
          <div className="lg:hidden absolute bottom-6 right-4 z-10">
            <Button
              size="lg"
              onClick={handleStartScan}
              className="rounded-full w-14 h-14 bg-neon-green text-black hover:bg-neon-green/90 shadow-lg shadow-neon-green/30"
            >
              <Activity className="w-6 h-6" />
            </Button>
          </div>

          <MapContainer
            ref={mapRef}
            pingLogs={state.logs}
            towers={state.towers}
            showTowers={state.showTowers}
            selectedHexbin={state.selectedHexbin}
            userLocation={userLocation}
            isTestingActive={isTestingActive}
            showHeatmap={showHeatmap}
            onBoundsChange={handleBoundsChange}
            onHexbinClick={handleHexbinClick}
          />
        </div>

        {/* Right Side - Sidebar (Fixed Width 350px on desktop, full width overlay on mobile) */}
        <aside
          className={`
            fixed lg:relative inset-y-0 right-0
            w-full sm:w-[350px] lg:w-[350px]
            flex flex-col border-l border-cyber-border
            bg-cyber-dark/95 lg:bg-cyber-dark/80 backdrop-blur-md z-20
            transform transition-transform duration-300 ease-in-out
            ${isMobileSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
            pt-12 lg:pt-0
          `}
        >
          {/* Sidebar Header / Search */}
          <div className="p-4 border-b border-cyber-border">
            <h2 className="text-neon-cyan text-xs font-bold uppercase tracking-widest mb-3">
              Operations Center
            </h2>
            <LocationSearch
              onSelect={handleLocationSearch}
              className="w-full"
            />
          </div>

          {/* Sidebar Content - Stats & Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* System Status Panel */}
            <div className="cyber-panel p-4 space-y-3">
              <h3 className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                System Status
              </h3>

              <div className="flex items-center justify-between font-mono text-sm">
                <span className="text-gray-400">Connection</span>
                {isOnline ? (
                  <span className="text-neon-green flex items-center gap-2">
                    <span className="status-dot-online" /> ONLINE
                  </span>
                ) : (
                  <span className="text-neon-red flex items-center gap-2">
                    <span className="status-dot-offline" /> OFFLINE
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between font-mono text-sm">
                <span className="text-gray-400">Total Scans</span>
                <span className="text-neon-cyan">{state.logs.length}</span>
              </div>

              <div className="flex items-center justify-between font-mono text-sm">
                <span className="text-gray-400">Pending Sync</span>
                <span className={state.pendingSync.length > 0 ? "text-neon-yellow" : "text-gray-500"}>
                  {state.pendingSync.length}
                </span>
              </div>
            </div>

            {/* Map Legend */}
            <div className="cyber-panel p-4">
              <h3 className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-3">
                Signal Quality
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-neon-green" />
                  <span className="text-sm text-gray-300">Excellent (&lt;50ms)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-neon-yellow" />
                  <span className="text-sm text-gray-300">Average (50-150ms)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-neon-red" />
                  <span className="text-sm text-gray-300">Poor (&gt;150ms)</span>
                </div>
              </div>
            </div>

            {/* Recent Scans / Live Feed */}
            <div className="cyber-panel p-4">
              <h3 className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-2">
                Recent Intel
              </h3>
              {state.logs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {state.logs.slice(-5).reverse().map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-xs p-2 rounded bg-cyber-black/50 border border-cyber-border"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            log.latencyMs <= 50
                              ? "bg-neon-green"
                              : log.latencyMs <= 150
                              ? "bg-neon-yellow"
                              : "bg-neon-red"
                          }`}
                        />
                        <span className="text-gray-300 truncate max-w-[120px]">
                          {log.reportedISP}
                        </span>
                      </div>
                      <span className="font-mono text-neon-cyan">{log.latencyMs}ms</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-xs text-muted-foreground/50 italic border border-dashed border-cyber-border rounded">
                  No scans recorded yet
                </div>
              )}
            </div>

          </div>

          {/* Sidebar Footer - Actions */}
          <div className="p-4 border-t border-cyber-border bg-cyber-black/50">
            <Button
              className="w-full bg-neon-green/10 text-neon-green border border-neon-green hover:bg-neon-green hover:text-black transition-all font-mono font-bold tracking-wider"
              onClick={handleStartScan}
            >
              INITIALIZE SCAN
            </Button>
          </div>

        </aside>
      </div>

      {/* Mobile overlay backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-10"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

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
