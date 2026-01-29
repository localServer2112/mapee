"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Wifi, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNetworkTest } from "@/hooks/useNetworkTest";
import { getLatencyStatus, getLatencyColor, getLatencyLabel } from "@/lib/latency";

interface TestingStepProps {
  onComplete: (latencyMs: number, jitter: number) => void;
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
        onComplete(testResult.latencyMs, testResult.jitter);
      }, 1000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center py-4"
    >
      <h2 className="text-xl font-semibold text-white mb-2 text-center">
        Network Speed Test
      </h2>
      <p className="text-sm text-slate-400 mb-8 text-center">
        {hasStarted
          ? "Testing your connection..."
          : "Tap the button to start testing"}
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

      {!hasStarted ? (
        /* Start button with pulse animation */
        <motion.div className="relative">
          {/* Pulse rings */}
          <motion.div
            className="absolute inset-0 rounded-full bg-ping-good/30"
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
            className="absolute inset-0 rounded-full bg-ping-good/30"
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
            className="relative w-32 h-32 rounded-full bg-ping-good text-white font-bold text-lg shadow-lg flex items-center justify-center"
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
              className="w-20 h-20 rounded-full bg-ping-good/20 flex items-center justify-center"
            >
              <Wifi className="w-10 h-10 text-ping-good" />
            </motion.div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-3" />
            <p className="text-center text-sm text-slate-400">
              {isRunning ? `Testing... ${progress}%` : "Complete!"}
            </p>
          </div>

          {/* Result preview */}
          {result && result.success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p className="text-4xl font-bold" style={{ color: getLatencyColor(getLatencyStatus(result.latencyMs)) }}>
                {result.latencyMs}ms
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {getLatencyLabel(getLatencyStatus(result.latencyMs))} Connection
              </p>
              {result.jitter > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Jitter: ±{result.jitter}ms
                </p>
              )}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Start button text hint */}
      {!hasStarted && (
        <p className="text-xs text-slate-500 mt-6">
          Tap the button above to start the test
        </p>
      )}
    </motion.div>
  );
}
