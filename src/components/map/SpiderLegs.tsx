"use client";

import { Polyline } from "react-leaflet";
import { CellTower } from "@/types";

interface SpiderLegsProps {
  centerLat: number;
  centerLng: number;
  towers: CellTower[];
}

/**
 * Draw spider-leg polylines from a center point to nearby cell towers
 */
export default function SpiderLegs({
  centerLat,
  centerLng,
  towers,
}: SpiderLegsProps) {
  if (towers.length === 0) return null;

  return (
    <>
      {towers.map((tower, index) => (
        <Polyline
          key={`spider-${tower.id}-${index}`}
          positions={[
            [centerLat, centerLng],
            [tower.lat, tower.lng],
          ]}
          pathOptions={{
            color: tower.type === "5G" ? "#8b5cf6" : "#3b82f6",
            weight: 2,
            opacity: 0.6,
            dashArray: "5, 10",
          }}
        />
      ))}
    </>
  );
}
