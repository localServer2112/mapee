"use client";

import dynamic from "next/dynamic";
import { forwardRef } from "react";
import { PingLog, HexBin, CellTower, MapBounds } from "@/types";
import type { MapRef } from "./LeafletMap";

// Dynamic import with SSR disabled - Leaflet requires browser APIs
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-cyber-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-neon-green border-t-transparent rounded-full animate-spin" />
        <span className="text-muted-foreground text-sm font-mono">Initializing map...</span>
      </div>
    </div>
  ),
});

interface MapContainerProps {
  pingLogs: PingLog[];
  towers: CellTower[];
  showTowers: boolean;
  selectedHexbin: HexBin | null;
  userLocation?: { lat: number; lng: number } | null;
  isTestingActive?: boolean;
  showHeatmap?: boolean;
  onBoundsChange?: (bounds: MapBounds, center: [number, number], zoom: number) => void;
  onHexbinClick?: (hexbin: HexBin) => void;
  onMarkerClick?: (log: PingLog) => void;
}

const MapContainerWrapper = forwardRef<MapRef, MapContainerProps>(
  function MapContainerWrapper(props, ref) {
    return <LeafletMap ref={ref} {...props} />;
  }
);

export default MapContainerWrapper;
export type { MapRef };
