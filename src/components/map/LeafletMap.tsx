"use client";

import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useCallback, useMemo } from "react";
import L from "leaflet";
import { PingLog, HexBin, CellTower, MapBounds } from "@/types";
import { MAP_CONFIG } from "@/lib/constants";
import { createHexbins } from "@/lib/hexbin";
import { findNearestTowers } from "@/lib/towers";
import PingMarker from "./PingMarker";
import TowerMarker from "./TowerMarker";
import SpiderLegs from "./SpiderLegs";
import HexbinLayer from "./HexbinLayer";
import UserLocationPulse from "./UserLocationPulse";

// Fix the default icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LeafletMapProps {
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

/**
 * Map event handler component
 */
function MapEventHandler({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: MapBounds, center: [number, number], zoom: number) => void;
}) {
  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      const bounds = map.getBounds();
      const center = map.getCenter();
      const zoom = map.getZoom();

      onBoundsChange?.(
        {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        [center.lat, center.lng],
        zoom
      );
    },
    zoomend: (e) => {
      const map = e.target;
      const bounds = map.getBounds();
      const center = map.getCenter();
      const zoom = map.getZoom();

      onBoundsChange?.(
        {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        [center.lat, center.lng],
        zoom
      );
    },
  });

  return null;
}

export default function LeafletMap({
  pingLogs,
  towers,
  showTowers,
  selectedHexbin,
  userLocation,
  isTestingActive = false,
  onBoundsChange,
  onHexbinClick,
  onMarkerClick,
}: LeafletMapProps) {
  // Generate hexbins from ping logs
  const hexbins = useMemo(() => createHexbins(pingLogs), [pingLogs]);

  // Get nearest towers for spider legs
  const nearestTowers = useMemo(() => {
    if (!selectedHexbin || !showTowers) return [];
    return findNearestTowers(
      selectedHexbin.centerLat,
      selectedHexbin.centerLng,
      towers,
      3
    );
  }, [selectedHexbin, towers, showTowers]);

  const handleHexbinClick = useCallback(
    (hexbin: HexBin) => {
      onHexbinClick?.(hexbin);
    },
    [onHexbinClick]
  );

  return (
    <MapContainer
      center={MAP_CONFIG.DEFAULT_CENTER}
      zoom={MAP_CONFIG.DEFAULT_ZOOM}
      minZoom={MAP_CONFIG.MIN_ZOOM}
      maxZoom={MAP_CONFIG.MAX_ZOOM}
      className="w-full h-full z-0"
      scrollWheelZoom={true}
      zoomControl={false}
    >
      {/* Dark tile layer */}
      <TileLayer
        attribution={MAP_CONFIG.DARK_TILE_ATTRIBUTION}
        url={MAP_CONFIG.DARK_TILE_URL}
      />

      {/* Map event handler */}
      <MapEventHandler onBoundsChange={onBoundsChange} />

      {/* Hexbin visualization layer */}
      <HexbinLayer hexbins={hexbins} onHexbinClick={handleHexbinClick} />

      {/* Individual ping markers (clustered) */}
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
      >
        {pingLogs.map((log) => (
          <PingMarker
            key={log.id}
            log={log}
            onClick={() => onMarkerClick?.(log)}
          />
        ))}
      </MarkerClusterGroup>

      {/* Cell tower markers */}
      {showTowers &&
        towers.map((tower) => (
          <TowerMarker key={tower.id} tower={tower} />
        ))}

      {/* Spider legs to nearest towers */}
      {selectedHexbin && showTowers && (
        <SpiderLegs
          centerLat={selectedHexbin.centerLat}
          centerLng={selectedHexbin.centerLng}
          towers={nearestTowers}
        />
      )}

      {/* User location pulse during testing */}
      {userLocation && (
        <UserLocationPulse
          lat={userLocation.lat}
          lng={userLocation.lng}
          isActive={isTestingActive}
        />
      )}
    </MapContainer>
  );
}
