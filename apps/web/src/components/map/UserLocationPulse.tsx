"use client";

import { CircleMarker, useMap } from "react-leaflet";
import { useEffect, useState } from "react";

interface UserLocationPulseProps {
  lat: number;
  lng: number;
  isActive: boolean;
}

/**
 * Animated radial pulse effect for user's location during testing
 */
export default function UserLocationPulse({
  lat,
  lng,
  isActive,
}: UserLocationPulseProps) {
  const map = useMap();
  const [pulseRadius, setPulseRadius] = useState(20);
  const [pulseOpacity, setPulseOpacity] = useState(0.8);

  // Animation loop for the pulse effect
  useEffect(() => {
    if (!isActive) {
      setPulseRadius(20);
      setPulseOpacity(0.8);
      return;
    }

    const animationInterval = setInterval(() => {
      setPulseRadius((prev) => {
        if (prev >= 60) return 20;
        return prev + 2;
      });
      setPulseOpacity((prev) => {
        if (prev <= 0) return 0.8;
        return prev - 0.04;
      });
    }, 50);

    return () => clearInterval(animationInterval);
  }, [isActive]);

  // Center map on user location when active
  useEffect(() => {
    if (isActive && lat && lng) {
      map.flyTo([lat, lng], 15, { duration: 1 });
    }
  }, [isActive, lat, lng, map]);

  if (!isActive) return null;

  return (
    <>
      {/* Outer pulse ring */}
      <CircleMarker
        center={[lat, lng]}
        radius={pulseRadius}
        pathOptions={{
          color: "#22c55e",
          fillColor: "#22c55e",
          fillOpacity: pulseOpacity * 0.3,
          weight: 2,
          opacity: pulseOpacity,
        }}
      />
      {/* Inner static circle */}
      <CircleMarker
        center={[lat, lng]}
        radius={10}
        pathOptions={{
          color: "#22c55e",
          fillColor: "#22c55e",
          fillOpacity: 0.8,
          weight: 3,
        }}
      />
    </>
  );
}
