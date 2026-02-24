"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { PingLog } from "@/types";
import { getLatencyStatus, getLatencyColor, getLatencyLabel } from "@/lib/latency";
import { formatLatency, formatTimestamp } from "@/lib/utils";

interface PingMarkerProps {
  log: PingLog;
  onClick?: () => void;
}

/**
 * Create a custom colored marker icon based on latency status
 */
function createLatencyIcon(latencyMs: number, isExact: boolean): L.DivIcon {
  const status = getLatencyStatus(latencyMs);
  const color = getLatencyColor(status);

  const borderStyle = isExact ? "solid" : "dashed";
  const opacity = isExact ? "1" : "0.7";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 3px ${borderStyle} white;
        border-radius: 50%;
        opacity: ${opacity};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: transform 0.2s ease;
      "
      onmouseenter="this.style.transform='scale(1.2)'"
      onmouseleave="this.style.transform='scale(1)'"
      ></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

export default function PingMarker({ log, onClick }: PingMarkerProps) {
  const status = getLatencyStatus(log.latencyMs);
  const statusLabel = getLatencyLabel(status);
  const isExact = log.isLocationExact ?? true;

  return (
    <Marker
      position={[log.lat, log.lng]}
      icon={createLatencyIcon(log.latencyMs, isExact)}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="p-2 min-w-[150px]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">{log.reportedISP}</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: getLatencyColor(status) }}
            >
              {statusLabel}
            </span>
          </div>
          {!isExact && (
            <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 font-medium">
              Geographic Region (Imprecise Location)
            </div>
          )}
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Latency:</span>
              <span className="font-medium">{formatLatency(log.latencyMs)}</span>
            </div>
            {log.jitter > 0 && (
              <div className="flex justify-between">
                <span>Jitter:</span>
                <span className="font-medium">±{log.jitter}ms</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Device:</span>
              <span className="capitalize">{log.deviceType}</span>
            </div>
            <div className="flex justify-between">
              <span>Time:</span>
              <span>{formatTimestamp(log.timestamp)}</span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
