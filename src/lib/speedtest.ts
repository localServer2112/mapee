import { NetworkTestResult } from "@/types";
import { TEST_ENDPOINTS } from "./constants";
import { calculateMedianLatency, calculateJitter } from "./latency";

/**
 * Speed Test Utility
 *
 * Measures network latency using small HEAD requests.
 * Takes multiple samples and calculates median + jitter.
 */

const DEFAULT_SAMPLES = 5;
const SAMPLE_DELAY = 200; // ms between samples

/**
 * Perform a single latency measurement
 */
async function measureLatency(url: string): Promise<number | null> {
  try {
    const start = performance.now();

    await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      mode: "no-cors",
    });

    const end = performance.now();
    return end - start;
  } catch {
    return null;
  }
}

/**
 * Run a complete network test with multiple samples
 *
 * @param numSamples - Number of samples to take (default 5)
 * @param onProgress - Callback for progress updates (0-100)
 * @returns NetworkTestResult with latency, jitter, and samples
 */
export async function runNetworkTest(
  numSamples: number = DEFAULT_SAMPLES,
  onProgress?: (progress: number) => void
): Promise<NetworkTestResult> {
  const samples: number[] = [];
  const url = TEST_ENDPOINTS.PING_URL;

  for (let i = 0; i < numSamples; i++) {
    const latency = await measureLatency(url);

    if (latency !== null) {
      samples.push(latency);
    }

    // Update progress
    if (onProgress) {
      onProgress(Math.round(((i + 1) / numSamples) * 100));
    }

    // Wait between samples (except for the last one)
    if (i < numSamples - 1) {
      await new Promise((resolve) => setTimeout(resolve, SAMPLE_DELAY));
    }
  }

  // If all samples failed, try backup URL
  if (samples.length === 0) {
    const backupLatency = await measureLatency(TEST_ENDPOINTS.BACKUP_URL);
    if (backupLatency !== null) {
      samples.push(backupLatency);
    }
  }

  const success = samples.length > 0;
  const latencyMs = success ? calculateMedianLatency(samples) : 0;
  const jitter = success ? calculateJitter(samples) : 0;

  return {
    latencyMs,
    jitter,
    success,
    timestamp: Date.now(),
    samples,
  };
}

/**
 * Quick single-sample latency test
 */
export async function quickLatencyTest(): Promise<number | null> {
  return measureLatency(TEST_ENDPOINTS.PING_URL);
}

/**
 * Detect device type based on user agent and screen size
 */
export function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";

  const ua = navigator.userAgent.toLowerCase();
  const isMobile =
    /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isTablet = /ipad|tablet|playbook|silk/i.test(ua);

  if (isTablet) return "tablet";
  if (isMobile) return "mobile";

  // Check screen width as fallback
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";

  return "desktop";
}

/**
 * Get user agent string safely
 */
export function getUserAgent(): string {
  if (typeof window === "undefined") return "unknown";
  return navigator.userAgent;
}
