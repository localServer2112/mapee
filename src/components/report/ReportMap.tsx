"use client";

import { MapContainer, TileLayer, Circle } from "react-leaflet";
import { MAP_CONFIG } from "@/lib/constants";

interface ReportMapProps {
  lat: number;
  lng: number;
}

export default function ReportMap({ lat, lng }: ReportMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      className="w-full h-full rounded-sm"
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      attributionControl={false}
    >
      <TileLayer
        url={MAP_CONFIG.DARK_TILE_URL}
        attribution={MAP_CONFIG.DARK_TILE_ATTRIBUTION}
      />
      <Circle
        center={[lat, lng]}
        radius={100}
        pathOptions={{
          color: "#00FFFF",
          fillColor: "#00FFFF",
          fillOpacity: 0.15,
          weight: 1.5,
          opacity: 0.6,
        }}
      />
      <Circle
        center={[lat, lng]}
        radius={10}
        pathOptions={{
          color: "#00FFFF",
          fillColor: "#00FFFF",
          fillOpacity: 0.6,
          weight: 0,
        }}
      />
    </MapContainer>
  );
}
