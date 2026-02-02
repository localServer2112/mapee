"use client";

import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import L from "leaflet";
import { PingLog, HexBin, CellTower, MapBounds, GeocodeResult } from "@/types";
import { MAP_CONFIG } from "@/lib/constants";
import { createHexbins } from "@/lib/hexbin";
import { findNearestTowers } from "@/lib/towers";
import PingMarker from "./PingMarker";
import TowerMarker from "./TowerMarker";
import SpiderLegs from "./SpiderLegs";
import HexbinLayer from "./HexbinLayer";
import HeatmapLayer from "./HeatmapLayer";
import UserLocationPulse from "./UserLocationPulse";

// Fix the default icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export interface MapRef {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  flyToBounds: (bounds: [[number, number], [number, number]]) => void;
  getMap: () => L.Map | null;
}

interface LeafletMapProps {
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

/**
 * Map controller component for flying to locations
 */
function MapController({
  onMapReady,
}: {
  onMapReady: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  return null;
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

const LeafletMap = forwardRef<MapRef, LeafletMapProps>(function LeafletMap(
  {
    pingLogs,
    towers,
    showTowers,
    selectedHexbin,
    userLocation,
    isTestingActive = false,
    showHeatmap = false,
    onBoundsChange,
    onHexbinClick,
    onMarkerClick,
  },
  ref
) {
  // Store map reference
  const mapRef = useMemo<{ current: L.Map | null }>(() => ({ current: null }), []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, zoom: number = 14) => {
      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], zoom, {
          duration: 1.5,
          easeLinearity: 0.25,
        });
      }
    },
    flyToBounds: (bounds: [[number, number], [number, number]]) => {
      if (mapRef.current) {
        mapRef.current.flyToBounds(bounds, {
          padding: [50, 50],
          duration: 1.5,
        });
      }
    },
    getMap: () => mapRef.current,
  }));

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []); // mapRef is intentionally stable and not a dependency

  // Get selected hexbin ID for highlighting
  const selectedHexbinId = selectedHexbin
    ? `${selectedHexbin.x}-${selectedHexbin.y}`
    : undefined;

  return (
    <MapContainer
      center={MAP_CONFIG.DEFAULT_CENTER}
      zoom={MAP_CONFIG.DEFAULT_ZOOM}
      minZoom={MAP_CONFIG.MIN_ZOOM}
      maxZoom={MAP_CONFIG.MAX_ZOOM}
      className="w-full h-full z-0"
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
      zoomControl={false}
    >
      {/* Dark tile layer */}
      <TileLayer
        attribution={MAP_CONFIG.DARK_TILE_ATTRIBUTION}
        url={MAP_CONFIG.DARK_TILE_URL}
      />

      {/* Map controller for external control */}
      <MapController onMapReady={handleMapReady} />

      {/* Map event handler */}
      <MapEventHandler onBoundsChange={onBoundsChange} />

      {/* Heatmap layer (optional, shown at lower zoom levels) */}
      {showHeatmap && <HeatmapLayer pingLogs={pingLogs} />}

      {/* Hexbin visualization layer */}
      <HexbinLayer
        hexbins={hexbins}
        onHexbinClick={handleHexbinClick}
        selectedHexbinId={selectedHexbinId}
      />

      {/* Individual ping markers (clustered) */}
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        iconCreateFunction={(cluster: { getChildCount: () => number }) => {
          const count = cluster.getChildCount();
          let size = "small";
          if (count > 10) size = "medium";
          if (count > 50) size = "large";

          return L.divIcon({
            html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
            className: "custom-cluster-icon",
            iconSize: L.point(40, 40),
          });
        }}
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
});

export default LeafletMap;
