"use client";

import { useState, useCallback, useRef } from "react";
import { MapBounds } from "@/types";

interface UseMapBoundsReturn {
  bounds: MapBounds | null;
  center: [number, number] | null;
  zoom: number;
  updateBounds: (bounds: MapBounds, center: [number, number], zoom: number) => void;
  isWithinBounds: (lat: number, lng: number) => boolean;
}

export function useMapBounds(): UseMapBoundsReturn {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState(4);

  // Debounce ref to avoid too many updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateBounds = useCallback(
    (newBounds: MapBounds, newCenter: [number, number], newZoom: number) => {
      // Clear any pending update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Debounce the update
      updateTimeoutRef.current = setTimeout(() => {
        setBounds(newBounds);
        setCenter(newCenter);
        setZoom(newZoom);
      }, 100);
    },
    []
  );

  const isWithinBounds = useCallback(
    (lat: number, lng: number): boolean => {
      if (!bounds) return false;

      return (
        lat >= bounds.south &&
        lat <= bounds.north &&
        lng >= bounds.west &&
        lng <= bounds.east
      );
    },
    [bounds]
  );

  return {
    bounds,
    center,
    zoom,
    updateBounds,
    isWithinBounds,
  };
}
