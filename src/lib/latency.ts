import { LatencyStatus } from "@/types";
import { LATENCY_THRESHOLDS } from "./constants";

/**
 * Classify latency into status categories
 */
export function getLatencyStatus(latencyMs: number): LatencyStatus {
  if (latencyMs <= LATENCY_THRESHOLDS.GOOD) return "good";
  if (latencyMs <= LATENCY_THRESHOLDS.FAIR) return "fair";
  return "poor";
}

/**
 * Get the color for a latency status
 */
export function getLatencyColor(status: LatencyStatus): string {
  const colors = {
    good: "#22c55e", // ping-good (green)
    fair: "#eab308", // ping-fair (yellow)
    poor: "#ef4444", // ping-poor (red)
  };
  return colors[status];
}

/**
 * Get the Tailwind class for a latency status
 */
export function getLatencyColorClass(status: LatencyStatus): string {
  const classes = {
    good: "bg-ping-good",
    fair: "bg-ping-fair",
    poor: "bg-ping-poor",
  };
  return classes[status];
}

/**
 * Get a human-readable label for a latency status
 */
export function getLatencyLabel(status: LatencyStatus): string {
  const labels = {
    good: "Excellent",
    fair: "Average",
    poor: "Poor",
  };
  return labels[status];
}

/**
 * Get the badge variant for a latency status
 */
export function getLatencyBadgeVariant(
  status: LatencyStatus
): "default" | "secondary" | "destructive" {
  const variants = {
    good: "default" as const,
    fair: "secondary" as const,
    poor: "destructive" as const,
  };
  return variants[status];
}

/**
 * Calculate the average latency from an array of pings
 */
export function calculateAverageLatency(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sum = latencies.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / latencies.length);
}

/**
 * Calculate the median latency from an array of values
 */
export function calculateMedianLatency(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Calculate standard deviation (jitter) from latency samples
 */
export function calculateJitter(latencies: number[]): number {
  if (latencies.length < 2) return 0;
  const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const squaredDiffs = latencies.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / latencies.length;
  return Math.round(Math.sqrt(variance));
}
