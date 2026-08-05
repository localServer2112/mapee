"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { CellTower } from "@/types";

interface TowerMarkerProps {
  tower: CellTower;
  onClick?: () => void;
}

/**
 * Create a custom tower icon based on tower type (4G/5G)
 */
function createTowerIcon(type: "4G" | "5G"): L.DivIcon {
  const is5G = type === "5G";
  const color = is5G ? "#8b5cf6" : "#3b82f6"; // Purple for 5G, Blue for 4G

  // SVG icons
  const antennaIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12 7 2"/><path d="m7 12 5-10"/><path d="m12 12 5-10"/><path d="m17 12 5-10"/><path d="M4.5 7h15"/><path d="M12 16v6"/></svg>`;
  const boltIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>`;

  return L.divIcon({
    className: "tower-marker",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${is5G ? boltIcon : antennaIcon}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export default function TowerMarker({ tower, onClick }: TowerMarkerProps) {
  return (
    <Marker
      position={[tower.lat, tower.lng]}
      icon={createTowerIcon(tower.type)}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="p-2 min-w-[140px]">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
                tower.type === "5G" ? "bg-purple-500" : "bg-blue-500"
              }`}
            >
              {tower.type}
            </span>
            <span className="font-semibold text-sm">Cell Tower</span>
          </div>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Cell ID:</span>
              <span className="font-mono">{tower.cellId}</span>
            </div>
            <div className="flex justify-between">
              <span>MCC:</span>
              <span className="font-mono">{tower.mcc}</span>
            </div>
            <div className="flex justify-between">
              <span>MNC:</span>
              <span className="font-mono">{tower.mnc}</span>
            </div>
            <div className="flex justify-between">
              <span>LAC:</span>
              <span className="font-mono">{tower.lac}</span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
