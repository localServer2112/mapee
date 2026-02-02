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
        className="w-20 h-20 rounded-sm bg-neon-cyan/10 flex items-center justify-center mb-6 border border-neon-cyan/30"
      >
        <MapPin className="w-10 h-10 text-neon-cyan" />
      </motion.div>

      {/* Title */}
      <h2 className="text-xl font-bold text-foreground mb-2 font-mono">
        ENABLE LOCATION
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        We need your location to map network quality in your area.
      </p>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 px-4 py-4 mb-4 bg-neon-red/10 border border-neon-red/30 rounded-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-neon-red flex-shrink-0" />
            <span className="text-sm text-neon-red font-mono text-left">{error}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            On macOS: System Settings → Privacy & Security → Location Services
          </p>
        </motion.div>
      )}

      {/* Privacy disclaimer */}
      <div className="flex items-start gap-2 p-3 cyber-card mb-6 text-left">
        <Shield className="w-4 h-4 text-neon-green mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">{getPrivacyDisclaimer()}</p>
      </div>

      {/* Action button */}
      <Button
        onClick={handleRequest}
        disabled={isLoading}
        className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold font-mono"
      >
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-black border-t-transparent rounded-full mr-2"
            />
            GETTING LOCATION...
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4 mr-2" />
            ALLOW LOCATION
          </>
        )}
      </Button>
    </motion.div>
  );
}
