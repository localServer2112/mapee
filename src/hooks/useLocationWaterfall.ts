"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Coordinates } from "@/types";
import { jitterCoordinates } from "@/lib/privacy";

/**
 * Location source types:
 * - 'ip': Location from IP-based geolocation (city-level accuracy)
 * - 'gps': Location from browser geolocation API (high accuracy)
 * - 'searching': Currently searching for GPS location
 * - 'none': No location available yet
 */
export type LocationSource = "ip" | "gps" | "searching" | "none";

interface IPLocationResponse {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string; // "lat,lng" format
  org?: string;
  timezone?: string;
}

interface UseLocationWaterfallReturn {
  coordinates: Coordinates | null;
  locationSource: LocationSource;
  isSearchingGPS: boolean;
  error: string | null;
  ipLocation: Coordinates | null;
  gpsLocation: Coordinates | null;
  refineWithGPS: () => Promise<Coordinates | null>;
  reset: () => void;
}

// GPS timeout threshold (6 seconds as specified)
const GPS_TIMEOUT = 6000;

// Minimum distance (in meters) to consider GPS location as "significantly different"
const MIN_DISTANCE_THRESHOLD = 100;

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse kCLError codes from error messages
 * These are macOS CoreLocation error codes
 */
function isKnownLocationError(error: GeolocationPositionError): boolean {
  // kCLErrorLocationUnknown = 0, kCLErrorDenied = 1, kCLErrorNetwork = 2
  // POSITION_UNAVAILABLE maps to kCLErrorLocationUnknown
  return (
    error.code === error.POSITION_UNAVAILABLE ||
    error.code === error.TIMEOUT ||
    error.message.includes("kCLError")
  );
}

/**
 * Fetch location from IP-based geolocation service
 */
async function fetchIPLocation(): Promise<Coordinates | null> {
  try {
    // Use ipinfo.io with the API token from environment
    const response = await fetch("https://ipinfo.io/json", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn("[LocationWaterfall] IP geolocation request failed:", response.status);
      return null;
    }

    const data: IPLocationResponse = await response.json();

    if (!data.loc) {
      console.warn("[LocationWaterfall] IP geolocation returned no location");
      return null;
    }

    const [lat, lng] = data.loc.split(",").map(Number);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn("[LocationWaterfall] Invalid coordinates from IP geolocation");
      return null;
    }

    console.log(`[LocationWaterfall] IP location: ${data.city || "Unknown"}, ${data.country || "Unknown"}`);

    return {
      lat,
      lng,
      accuracy: 5000, // City-level accuracy (~5km)
    };
  } catch (error) {
    console.warn("[LocationWaterfall] IP geolocation error:", error);
    return null;
  }
}

/**
 * Get browser geolocation with configurable accuracy
 */
function getBrowserLocation(
  enableHighAccuracy: boolean,
  timeout: number
): Promise<Coordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("[LocationWaterfall] Geolocation API not available");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Apply privacy jittering
        const jittered = jitterCoordinates(
          position.coords.latitude,
          position.coords.longitude
        );

        const coords: Coordinates = {
          lat: jittered.lat,
          lng: jittered.lng,
          accuracy: position.coords.accuracy,
        };

        console.log(
          `[LocationWaterfall] GPS location obtained (accuracy: ${position.coords.accuracy.toFixed(0)}m)`
        );

        resolve(coords);
      },
      (error) => {
        // Log error for debugging but don't expose to UI
        if (isKnownLocationError(error)) {
          console.debug(
            `[LocationWaterfall] GPS error (silently handled): ${error.code} - ${error.message}`
          );
        } else {
          console.warn(`[LocationWaterfall] GPS error: ${error.code} - ${error.message}`);
        }
        resolve(null);
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge: 60000, // Accept cached position up to 1 minute old
      }
    );
  });
}

/**
 * Fail-Safe Location Waterfall Hook
 *
 * Implements a two-tier location strategy:
 * 1. Primary (Baseline): IP-based geolocation for immediate location
 * 2. Secondary (Precision): Browser GPS for high-accuracy refinement
 *
 * If GPS fails, times out, or returns LocationUnknown, it silently falls back to IP location.
 */
export function useLocationWaterfall(): UseLocationWaterfallReturn {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>("none");
  const [ipLocation, setIPLocation] = useState<Coordinates | null>(null);
  const [gpsLocation, setGPSLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isInitialized = useRef(false);
  const gpsAbortController = useRef<AbortController | null>(null);

  /**
   * Initialize with IP-based location on mount
   */
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initializeLocation = async () => {
      // Step 1: Get IP-based location immediately
      const ipCoords = await fetchIPLocation();

      if (ipCoords) {
        setIPLocation(ipCoords);
        setCoordinates(ipCoords);
        setLocationSource("ip");
      }
    };

    initializeLocation();
  }, []);

  /**
   * Attempt to refine location with GPS
   * This is called when user explicitly requests precise location
   */
  const refineWithGPS = useCallback(async (): Promise<Coordinates | null> => {
    // Abort any existing GPS request
    if (gpsAbortController.current) {
      gpsAbortController.current.abort();
    }
    gpsAbortController.current = new AbortController();

    setLocationSource("searching");
    setError(null);

    try {
      // First attempt: Quick fix with low accuracy (cell towers/Wi-Fi)
      // This avoids the hardware GPS "search" hang-up
      let gpsCoords = await getBrowserLocation(false, GPS_TIMEOUT);

      // Second attempt: If quick fix succeeded but accuracy is poor, try high accuracy
      if (gpsCoords && gpsCoords.accuracy > 100) {
        console.log("[LocationWaterfall] Quick fix accuracy poor, trying high accuracy...");
        const highAccuracyCoords = await getBrowserLocation(true, GPS_TIMEOUT);
        if (highAccuracyCoords && highAccuracyCoords.accuracy < gpsCoords.accuracy) {
          gpsCoords = highAccuracyCoords;
        }
      }

      // If no quick fix, try high accuracy as fallback
      if (!gpsCoords) {
        console.log("[LocationWaterfall] Quick fix failed, trying high accuracy...");
        gpsCoords = await getBrowserLocation(true, GPS_TIMEOUT);
      }

      if (gpsCoords) {
        setGPSLocation(gpsCoords);

        // Only update if significantly different or higher accuracy
        const shouldUpdate =
          !coordinates ||
          gpsCoords.accuracy < coordinates.accuracy ||
          calculateDistance(
            coordinates.lat,
            coordinates.lng,
            gpsCoords.lat,
            gpsCoords.lng
          ) > MIN_DISTANCE_THRESHOLD;

        if (shouldUpdate) {
          setCoordinates(gpsCoords);
          setLocationSource("gps");
          return gpsCoords;
        } else {
          // GPS location not significantly different, keep current
          setLocationSource(ipLocation ? "ip" : "gps");
          return coordinates;
        }
      }

      // GPS failed - silently fall back to IP location
      console.log("[LocationWaterfall] GPS unavailable, using IP location");
      setLocationSource(ipLocation ? "ip" : "none");

      // If we have IP location, return that without showing error
      if (ipLocation) {
        setCoordinates(ipLocation);
        return ipLocation;
      }

      // Only show error if we have no location at all
      setError("Unable to determine location. Please search for your area manually.");
      return null;
    } catch (err) {
      console.error("[LocationWaterfall] Unexpected error:", err);
      setLocationSource(ipLocation ? "ip" : "none");

      if (ipLocation) {
        return ipLocation;
      }

      setError("Location service unavailable");
      return null;
    }
  }, [coordinates, ipLocation]);

  /**
   * Reset location state
   */
  const reset = useCallback(() => {
    setCoordinates(ipLocation);
    setLocationSource(ipLocation ? "ip" : "none");
    setGPSLocation(null);
    setError(null);
  }, [ipLocation]);

  return {
    coordinates,
    locationSource,
    isSearchingGPS: locationSource === "searching",
    error,
    ipLocation,
    gpsLocation,
    refineWithGPS,
    reset,
  };
}
