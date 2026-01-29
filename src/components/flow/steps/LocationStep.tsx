"use client";

import { motion } from "framer-motion";
import { MapPin, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Coordinates } from "@/types";
import { getPrivacyDisclaimer } from "@/lib/privacy";

interface LocationStepProps {
  onGranted: (coords: Coordinates) => void;
}

export default function LocationStep({ onGranted }: LocationStepProps) {
  const { isLoading, error, requestPermission } = useGeolocation();

  const handleRequest = async () => {
    const coords = await requestPermission();
    if (coords) {
      onGranted(coords);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-4"
    >
      {/* Icon */}
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-20 h-20 rounded-full bg-ping-good/20 flex items-center justify-center mb-6"
      >
        <MapPin className="w-10 h-10 text-ping-good" />
      </motion.div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-white mb-2">
        Enable Location Access
      </h2>
      <p className="text-sm text-slate-400 mb-6 max-w-xs">
        We need your location to map network quality in your area.
      </p>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg"
        >
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </motion.div>
      )}

      {/* Privacy disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-slate-800/50 rounded-lg mb-6 text-left">
        <Shield className="w-4 h-4 text-ping-good mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400">{getPrivacyDisclaimer()}</p>
      </div>

      {/* Action button */}
      <Button
        onClick={handleRequest}
        disabled={isLoading}
        className="w-full bg-ping-good hover:bg-ping-good/90 text-white"
      >
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
            />
            Getting Location...
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4 mr-2" />
            Allow Location Access
          </>
        )}
      </Button>
    </motion.div>
  );
}
