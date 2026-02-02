"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Wifi, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNetworkTest } from "@/hooks/useNetworkTest";
import { getLatencyStatus, getLatencyColor, getLatencyLabel } from "@/lib/latency";

interface TestingStepProps {
  onComplete: (latencyMs: number, jitter: number, uploadSpeed: number, downloadSpeed: number) => void;
}

export default function TestingStep({ onComplete }: TestingStepProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const { runTest, isRunning, progress, result, error } = useNetworkTest();

  const handleStart = async () => {
    setHasStarted(true);
    const testResult = await runTest();
    if (testResult.success) {
      // Small delay to show the result before transitioning
      setTimeout(() => {
        onComplete(
          testResult.latencyMs,
          testResult.jitter,
          testResult.uploadSpeed,
          testResult.downloadSpeed
        );
      }, 1500); // Increased delay slightly to let user see metrics
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center py-4"
    >
      <h2 className="text-xl font-bold text-foreground mb-2 text-center font-mono">
        NETWORK TEST
      </h2>
      <p className="text-sm text-muted-foreground mb-8 text-center font-mono">
        {hasStarted
          ? "TESTING CONNECTION..."
          : "TAP TO START TEST"}
      </p>

      {/* Error message with retry */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 px-4 py-4 mb-4 bg-neon-red/10 border border-neon-red/30 rounded-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-neon-red" />
            <span className="text-sm text-neon-red font-mono">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHasStarted(false);
            }}
            className="text-neon-red border-neon-red hover:bg-neon-red hover:text-black font-mono"
          >
            RETRY TEST
          </Button>
        </motion.div>
      )}

      {!hasStarted ? (
        /* Start button with pulse animation */
        <motion.div className="relative">
          {/* Pulse rings */}
          <motion.div
            className="absolute inset-0 rounded-full bg-neon-cyan/20"
            animate={{
              scale: [1, 1.5, 1.8],
              opacity: [0.5, 0.3, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-full bg-neon-cyan/20"
            animate={{
              scale: [1, 1.3, 1.5],
              opacity: [0.5, 0.3, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.5,
            }}
          />

          {/* Main button */}
          <motion.button
            onClick={handleStart}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-32 h-32 rounded-full bg-neon-cyan text-black font-bold text-lg shadow-neon-cyan-lg flex items-center justify-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Wifi className="w-10 h-10" />
            </motion.div>
          </motion.button>
        </motion.div>
      ) : (
        /* Testing progress */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full space-y-6"
        >
          {/* Animated icon */}
          <div className="flex justify-center mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: isRunning ? Infinity : 0, ease: "linear" }}
              className="w-20 h-20 rounded-sm bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/30"
            >
              <Wifi className="w-10 h-10 text-neon-cyan" />
            </motion.div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground font-mono">
              {isRunning ? `TESTING... ${progress}%` : "COMPLETE!"}
            </p>
          </div>

          {/* Result preview */}
          {result && result.success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p className="text-4xl font-bold font-mono" style={{ color: getLatencyColor(getLatencyStatus(result.latencyMs)) }}>
                {result.latencyMs}ms
              </p>
              <p className="text-sm font-mono mt-1" style={{ color: getLatencyColor(getLatencyStatus(result.latencyMs)) }}>
                {getLatencyLabel(getLatencyStatus(result.latencyMs)).toUpperCase()} CONNECTION
              </p>
              {result.jitter > 0 && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  JITTER: ±{result.jitter}ms
                </p>
              )}
              <div className="flex gap-4 justify-center mt-3 text-xs font-mono text-muted-foreground">
                <div>↓ {result.downloadSpeed} Mbps</div>
                <div>↑ {result.uploadSpeed} Mbps</div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Start button text hint */}
      {!hasStarted && (
        <p className="text-xs text-muted-foreground mt-6 font-mono">
          TAP THE BUTTON ABOVE TO START
        </p>
      )}
    </motion.div>
  );
}
