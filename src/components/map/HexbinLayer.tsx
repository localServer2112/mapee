"use client";

import { useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { HexBin } from "@/types";
import { getLatencyStatus, getLatencyColor } from "@/lib/latency";

interface HexbinLayerProps {
  hexbins: HexBin[];
  onHexbinClick?: (hexbin: HexBin) => void;
  selectedHexbinId?: string;
}

/**
 * Custom Leaflet layer for rendering hexagonal bins
 * with improved styling and interactivity
 */
export default function HexbinLayer({
  hexbins,
  onHexbinClick,
  selectedHexbinId,
}: HexbinLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [hoveredHexId, setHoveredHexId] = useState<string | null>(null);

  useEffect(() => {
    // Remove existing layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    // Create new layer group
    const layerGroup = L.layerGroup();
    layerRef.current = layerGroup;

    // Get current zoom to adjust hexagon size
    const zoom = map.getZoom();
    const baseRadius = 0.003; // ~300m at equator
    const radiusMultiplier = Math.max(0.5, Math.min(2, 14 / zoom));
    const hexRadius = baseRadius * radiusMultiplier;

    // Add hexbins to the layer
    hexbins.forEach((hexbin) => {
      const hexId = `${hexbin.x}-${hexbin.y}`;
      const status = getLatencyStatus(hexbin.avgLatency);
      const baseColor = getLatencyColor(status);
      const isSelected = selectedHexbinId === hexId;
      const isHovered = hoveredHexId === hexId;

      // Create a polygon for the hexbin
      const hexPoints = getHexagonPoints(
        hexbin.centerLat,
        hexbin.centerLng,
        hexRadius
      );

      // Calculate opacity based on confidence and ping count
      const confidenceOpacity = Math.min(0.8, 0.3 + hexbin.confidence / 150);
      const pingCountBonus = Math.min(0.2, hexbin.pings.length * 0.02);
      const baseOpacity = Math.min(0.85, confidenceOpacity + pingCountBonus);

      const polygon = L.polygon(hexPoints, {
        color: isSelected ? "#00FFFF" : isHovered ? "#FFFFFF" : "rgba(255,255,255,0.2)",
        fillColor: baseColor,
        fillOpacity: isSelected ? 0.9 : isHovered ? baseOpacity + 0.1 : baseOpacity,
        weight: isSelected ? 3 : isHovered ? 2 : 1,
        className: `hexbin-hexagon ${isSelected ? "hexbin-selected" : ""}`,
      });

      // Add event handlers
      polygon.on("click", () => {
        onHexbinClick?.(hexbin);
      });

      polygon.on("mouseover", () => {
        setHoveredHexId(hexId);
        polygon.setStyle({
          weight: 2,
          color: "#FFFFFF",
          fillOpacity: baseOpacity + 0.1,
        });
      });

      polygon.on("mouseout", () => {
        setHoveredHexId(null);
        if (!isSelected) {
          polygon.setStyle({
            weight: 1,
            color: "rgba(255,255,255,0.2)",
            fillOpacity: baseOpacity,
          });
        }
      });

      // Add tooltip with rich information
      const consistencyLabel = hexbin.consistency >= 80 ? "Stable" : hexbin.consistency >= 50 ? "Variable" : "Unstable";
      const confidenceLabel = hexbin.confidence >= 70 ? "High" : hexbin.confidence >= 40 ? "Medium" : "Low";

      polygon.bindTooltip(
        `
        <div class="hexbin-tooltip-content text-gray-100 min-w-[160px]">
          <div class="font-bold text-sm mb-2 text-neon-cyan border-b border-cyber-border pb-1">${hexbin.topISP}</div>
          <div class="flex flex-col gap-y-1.5 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-gray-400">Avg Latency:</span>
              <span class="font-mono text-sm shadow-sm" style="color: ${baseColor}; font-weight: bold;">${Math.round(hexbin.avgLatency)}ms</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-400">Scans:</span>
              <span class="font-mono text-gray-200">${hexbin.pings.length}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-400">Consistency:</span>
              <span class="text-gray-200">${consistencyLabel}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-400">Confidence:</span>
              <span class="text-gray-200">${confidenceLabel}</span>
            </div>
          </div>
        </div>
        `,
        {
          sticky: true,
          className: "hexbin-tooltip",
          direction: "top",
          offset: [0, -10],
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
  }, [hexbins, map, onHexbinClick, selectedHexbinId, hoveredHexId]);

  return null;
}

/**
 * Generate hexagon corner points (flat-topped hexagon)
 */
function getHexagonPoints(
  centerLat: number,
  centerLng: number,
  radius: number
): [number, number][] {
  const points: [number, number][] = [];

  // Flat-topped hexagon: angles start at 0° (pointing right)
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i; // 60° increments
    const lat = centerLat + radius * Math.sin(angle);
    // Adjust longitude for latitude (cos correction for map projection)
    const lngCorrection = Math.cos((centerLat * Math.PI) / 180);
    const lng = centerLng + (radius * Math.cos(angle)) / lngCorrection;
    points.push([lat, lng]);
  }

  return points;
}
