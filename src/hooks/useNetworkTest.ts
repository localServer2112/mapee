"use client";

import { useState, useCallback } from "react";
import { NetworkTestResult } from "@/types";
import { runNetworkTest } from "@/lib/speedtest";

interface UseNetworkTestReturn {
  runTest: () => Promise<NetworkTestResult>;
  isRunning: boolean;
  progress: number;
  result: NetworkTestResult | null;
  error: string | null;
  reset: () => void;
}

export function useNetworkTest(): UseNetworkTestReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<NetworkTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = useCallback(async (): Promise<NetworkTestResult> => {
    setIsRunning(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const testResult = await runNetworkTest(5, (p) => setProgress(p));

      if (!testResult.success) {
        setError("Network test failed. Please check your connection.");
      }

      setResult(testResult);
      return testResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);

      const failedResult: NetworkTestResult = {
        latencyMs: 0,
        jitter: 0,
        success: false,
        timestamp: Date.now(),
        samples: [],
      };

      setResult(failedResult);
      return failedResult;
    } finally {
      setIsRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  return {
    runTest,
    isRunning,
    progress,
    result,
    error,
    reset,
  };
}
