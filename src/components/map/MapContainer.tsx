"use client";

import dynamic from "next/dynamic";
import { PingLog, HexBin, CellTower, MapBounds } from "@/types";

// Dynamic import with SSR disabled - Leaflet requires browser APIs
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-ping-good border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Loading map...</span>
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
  onBoundsChange?: (bounds: MapBounds, center: [number, number], zoom: number) => void;
  onHexbinClick?: (hexbin: HexBin) => void;
  onMarkerClick?: (log: PingLog) => void;
}

export default function MapContainer(props: MapContainerProps) {
  return <LeafletMap {...props} />;
}
