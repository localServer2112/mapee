"use client";

import { PingLog, HexBin, CellTower, MapBounds } from "@/types";
import LeafletMap, { type MapRef } from "./LeafletMap";

// This component is dynamically imported in page.tsx with ssr: false.
// We use a callback pattern for map methods since dynamic() doesn't forward refs.

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
  onMapReady?: (mapMethods: MapRef) => void;
}

export default function MapContainerWrapper(props: MapContainerProps) {
  return <LeafletMap {...props} />;
}

export type { MapRef };
