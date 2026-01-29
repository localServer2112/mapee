"use client";

import { useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { HexBin } from "@/types";
import { getLatencyStatus, getLatencyColor } from "@/lib/latency";

interface HexbinLayerProps {
  hexbins: HexBin[];
  onHexbinClick?: (hexbin: HexBin) => void;
}

/**
 * Custom Leaflet layer for rendering hexagonal bins
 */
export default function HexbinLayer({
  hexbins,
  onHexbinClick,
}: HexbinLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    // Remove existing layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    // Create new layer group
    const layerGroup = L.layerGroup();
    layerRef.current = layerGroup;

    // Add hexbins to the layer
    hexbins.forEach((hexbin) => {
      const status = getLatencyStatus(hexbin.avgLatency);
      const color = getLatencyColor(status);

      // Create a polygon for the hexbin
      const hexPoints = getHexagonPoints(
        hexbin.centerLat,
        hexbin.centerLng,
        0.003 // Radius in degrees (~300m)
      );

      const polygon = L.polygon(hexPoints, {
        color: "rgba(255,255,255,0.3)",
        fillColor: color,
        fillOpacity: Math.min(0.8, 0.3 + hexbin.confidence / 200),
        weight: 1,
        className: "hexbin-hexagon",
      });

      // Add click handler
      polygon.on("click", () => {
        onHexbinClick?.(hexbin);
      });

      // Add tooltip
      polygon.bindTooltip(
        `
        <div class="text-xs">
          <div class="font-semibold">${hexbin.topISP}</div>
          <div>${Math.round(hexbin.avgLatency)}ms avg</div>
          <div>${hexbin.pings.length} scans</div>
        </div>
      `,
        {
          sticky: true,
          className: "hexbin-tooltip",
        }
      );

      polygon.addTo(layerGroup);
    });

    // Add layer to map
    layerGroup.addTo(map);

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [hexbins, map, onHexbinClick]);

  return null;
}

/**
 * Generate hexagon corner points
 */
function getHexagonPoints(
  centerLat: number,
  centerLng: number,
  radius: number
): [number, number][] {
  const points: [number, number][] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6; // Flat-topped hexagon
    const lat = centerLat + radius * Math.sin(angle);
    const lng = centerLng + radius * Math.cos(angle);
    points.push([lat, lng]);
  }

  return points;
}
