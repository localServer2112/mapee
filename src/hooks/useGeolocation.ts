"use client";

import { useState, useCallback } from "react";
import { Coordinates } from "@/types";
import { jitterCoordinates } from "@/lib/privacy";

interface UseGeolocationReturn {
  coordinates: Coordinates | null;
  error: string | null;
  isLoading: boolean;
  requestPermission: () => Promise<Coordinates | null>;
  permissionState: PermissionState | null;
}

export function useGeolocation(): UseGeolocationReturn {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionState, setPermissionState] =
    useState<PermissionState | null>(null);

  const requestPermission = useCallback(async (): Promise<Coordinates | null> => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return null;
    }

    setIsLoading(true);
    setError(null);

    // Check permission state if available
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({
          name: "geolocation",
        });
        setPermissionState(permission.state);
      }
    } catch {
      // Permissions API not supported, continue anyway
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Apply jittering for privacy
          const jittered = jitterCoordinates(
            position.coords.latitude,
            position.coords.longitude
          );

          const coords: Coordinates = {
            lat: jittered.lat,
            lng: jittered.lng,
            accuracy: position.coords.accuracy,
          };

          setCoordinates(coords);
          setIsLoading(false);
          setPermissionState("granted");
          resolve(coords);
        },
        (err) => {
          let errorMessage: string;

          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = "Location permission denied. Please enable location access.";
              setPermissionState("denied");
              break;
            case err.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              break;
            case err.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
            default:
              errorMessage = "An unknown error occurred.";
          }

          setError(errorMessage);
          setIsLoading(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  return {
    coordinates,
    error,
    isLoading,
    requestPermission,
    permissionState,
  };
}
