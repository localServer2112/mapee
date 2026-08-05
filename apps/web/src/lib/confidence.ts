// Moved to @mapee/core so the API service computes confidence the same way.
// Re-exported so existing `@/lib/confidence` imports keep working.
export {
  getFreshnessWeight,
  filterFreshPings,
  calculateWeightedAverageLatency,
  getConfidenceLevel,
  calculateConfidenceScore,
  calculateConfidence,
  calculateConsistency,
  getTopISP,
  getISPRankings,
} from "@mapee/core";
export type { ConfidenceLevel, ConfidenceResult } from "@mapee/core";
