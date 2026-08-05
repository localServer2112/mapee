// Latency classification and sample statistics now live in @mapee/core.
// Re-exported so existing `@/lib/latency` imports keep working.
export {
  getLatencyStatus,
  getLatencyLabel,
  calculateAverageLatency,
  calculateMedianLatency,
  calculateJitter,
} from "@mapee/core";

import type { LatencyStatus } from "@mapee/core";

/**
 * Hex colour for a latency status.
 *
 * Stays in the web app rather than @mapee/core: these are this app's neon
 * palette, and the API has no use for colour values. The mobile app resolves
 * quality colour from its own semantic design tokens instead.
 */
export function getLatencyColor(status: LatencyStatus): string {
  const colors = {
    good: "#00FF88", // neon-green
    fair: "#FFD600", // neon-yellow
    poor: "#FF3366", // neon-red
  };
  return colors[status];
}
