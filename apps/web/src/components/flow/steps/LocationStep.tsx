"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Shield, Navigation, Loader2, Check, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocationWaterfall, LocationSource } from "@/hooks/useLocationWaterfall";
import { Coordinates } from "@/types";
import { getPrivacyDisclaimer } from "@/lib/privacy";

interface LocationStepProps {
  onGranted: (coords: Coordinates) => void;
}

/**
 * Get user-friendly location source label
 */
function getLocationSourceLabel(source: LocationSource): string {
  switch (source) {
    case "gps":
      return "GPS (High Accuracy)";
    case "ip":
      return "Network Location";
    case "searching":
      return "Searching for GPS...";
    default:
      return "Unknown";
  }
}

export default function LocationStep({ onGranted }: LocationStepProps) {
  const {
    coordinates,
    locationSource,
    isSearchingGPS,
    error,
    ipLocation,
    refineWithGPS,
    reset,
  } = useLocationWaterfall();

  const [hasAttemptedGPS, setHasAttemptedGPS] = useState(false);
  const [showLocationDetails, setShowLocationDetails] = useState(false);

  // Auto-proceed when we have a location (IP or GPS)
  // DELETED: User requested explicit accuracy rating instead of auto-proceed
  useEffect(() => {
    if (coordinates && locationSource !== "searching" && locationSource !== "none") {
      // Small delay to show the user what location source we're using
      const timer = setTimeout(() => {
        setShowLocationDetails(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [coordinates, locationSource]);

  const handleRequestPreciseLocation = async () => {
    setHasAttemptedGPS(true);
    const result = await refineWithGPS();
    if (result) {
      // GPS succeeded or we fell back to IP - proceed either way
      onGranted(result);
    }
  };

  const handleContinueWithIPLocation = () => {
    if (coordinates) {
      onGranted(coordinates);
    }
  };

  const handleInaccurateLocation = () => {
    setHasAttemptedGPS(false);
    setShowLocationDetails(false);
    reset();
  };

  // Show loading state while fetching IP location
  if (!ipLocation && !error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center text-center py-8"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-3 border-neon-cyan border-t-transparent rounded-full mb-4"
        />
        <p className="text-sm text-muted-foreground font-mono">
          DETECTING LOCATION...
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-4"
    >
      {/* Icon */}
      <motion.div
        animate={isSearchingGPS ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 1.5, repeat: isSearchingGPS ? Infinity : 0 }}
        className={`w-20 h-20 rounded-sm flex items-center justify-center mb-6 border transition-colors ${locationSource === "gps"
          ? "bg-neon-green/10 border-neon-green/30"
          : isSearchingGPS
            ? "bg-neon-yellow/10 border-neon-yellow/30"
            : "bg-neon-cyan/10 border-neon-cyan/30"
          }`}
      >
        {isSearchingGPS ? (
          <Loader2 className="w-10 h-10 text-neon-yellow animate-spin" />
        ) : locationSource === "gps" ? (
          <Check className="w-10 h-10 text-neon-green" />
        ) : (
          <MapPin className="w-10 h-10 text-neon-cyan" />
        )}
      </motion.div>

      {/* Title */}
      <h2 className="text-xl font-bold text-foreground mb-2 font-mono">
        {isSearchingGPS
          ? "LOCATING..."
          : coordinates
            ? "LOCATION DETECTED"
            : "ENABLE LOCATION"}
      </h2>

      {/* Status message */}
      <AnimatePresence mode="wait">
        {isSearchingGPS ? (
          <motion.p
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-neon-yellow mb-4 font-mono"
          >
            Searching for precise GPS signal...
          </motion.p>
        ) : showLocationDetails && coordinates ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <p className="text-sm text-muted-foreground mb-1">
              Location source: <span className="text-neon-cyan">{getLocationSourceLabel(locationSource)}</span>
            </p>
            <p className="text-xs text-muted-foreground/70 font-mono">
              {coordinates.lat.toFixed(4)}°, {coordinates.lng.toFixed(4)}°
              {coordinates.accuracy < 1000 && (
                <span className="ml-2">±{coordinates.accuracy.toFixed(0)}m</span>
              )}
            </p>
          </motion.div>
        ) : (
          <motion.p
            key="prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-muted-foreground mb-6 max-w-xs"
          >
            We need your location to map network quality in your area.
          </motion.p>
        )}
      </AnimatePresence>

      {/* Error message - only shown if no location at all */}
      {error && !coordinates && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-3 mb-4 bg-neon-red/10 border border-neon-red/30 rounded-sm"
        >
          <span className="text-sm text-neon-red font-mono">{error}</span>
        </motion.div>
      )}

      {/* Privacy disclaimer */}
      <div className="flex items-start gap-2 p-3 cyber-card mb-6 text-left">
        <Shield className="w-4 h-4 text-neon-green mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">{getPrivacyDisclaimer()}</p>
      </div>

      {/* Action buttons */}
      <div className="w-full space-y-3">
        {showLocationDetails && coordinates && !isSearchingGPS ? (
          /* Verification state: Location is detected and displayed */
          <>
            <Button
              onClick={() => onGranted(coordinates)}
              className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold font-mono"
            >
              <Check className="w-4 h-4 mr-2" />
              LOCATION IS ACCURATE
            </Button>

            <Button
              onClick={handleInaccurateLocation}
              variant="outline"
              className="w-full border-neon-red/50 text-neon-red hover:bg-neon-red hover:text-black hover:border-neon-red font-mono transition-colors"
            >
              <XIcon className="w-4 h-4 mr-2" />
              LOCATION IS INACCURATE
            </Button>
          </>
        ) : (
          /* Initial State: Request location */
          <>
            <Button
              onClick={handleRequestPreciseLocation}
              disabled={isSearchingGPS}
              className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold font-mono"
            >
              {isSearchingGPS ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  GETTING LOCATION...
                </>
              ) : hasAttemptedGPS && locationSource === "gps" ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  GPS LOCATION ACQUIRED
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" />
                  {hasAttemptedGPS ? "RETRY GPS" : "USE PRECISE LOCATION"}
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Subtle hint about GPS vs Network */}
      {!showLocationDetails && ipLocation && !hasAttemptedGPS && (
        <p className="text-xs text-muted-foreground/50 mt-4 max-w-xs">
          GPS provides street-level accuracy. Network location is approximate (city-level).
        </p>
      )}
    </motion.div>
  );
}
