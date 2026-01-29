import { PingLog } from "@/types";
import { DATA_FRESHNESS } from "./constants";
import { calculateJitter } from "./latency";

/**
 * Confidence Algorithm
 *
 * Score = (Unique pings in area) × (1 / StdDev of Latency)
 *
 * Data Freshness Weights:
 *   < 7 days:  1.0
 *   7-30 days: 0.5
 *   > 30 days: ignored
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceResult {
  score: number;
  topISP: string;
  confidenceLevel: ConfidenceLevel;
}

/**
 * Get the freshness weight for a ping based on its age
 */
export function getFreshnessWeight(timestamp: number): number {
  const now = Date.now();
  const ageMs = now - timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= DATA_FRESHNESS.FRESH_DAYS) {
    return 1.0;
  } else if (ageDays <= DATA_FRESHNESS.STALE_DAYS) {
    return 0.5;
  } else {
    return 0; // Expired - ignore
  }
}

/**
 * Filter pings to only include fresh ones (not expired)
 */
export function filterFreshPings(pings: PingLog[]): PingLog[] {
  return pings.filter((ping) => getFreshnessWeight(ping.timestamp) > 0);
}

/**
 * Calculate weighted average latency based on data freshness
 */
export function calculateWeightedAverageLatency(pings: PingLog[]): number {
  const freshPings = filterFreshPings(pings);
  if (freshPings.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  freshPings.forEach((ping) => {
    const weight = getFreshnessWeight(ping.timestamp);
    weightedSum += ping.latencyMs * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Get confidence level based on score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Calculate the confidence score for a set of pings
 *
 * Higher score = more reliable data
 * Score considers: number of pings, consistency (low std dev), freshness
 */
export function calculateConfidenceScore(pings: PingLog[]): number {
  const freshPings = filterFreshPings(pings);
  if (freshPings.length === 0) return 0;

  // Factor 1: Number of unique pings (weighted by freshness)
  let weightedCount = 0;
  freshPings.forEach((ping) => {
    weightedCount += getFreshnessWeight(ping.timestamp);
  });

  // Factor 2: Consistency (inverse of standard deviation)
  const latencies = freshPings.map((p) => p.latencyMs);
  const jitter = calculateJitter(latencies);
  // Avoid division by zero; add 1 to jitter
  const consistencyFactor = 1 / (jitter + 1);

  // Combine factors
  // Normalize: more pings and lower jitter = higher score
  const rawScore = weightedCount * consistencyFactor * 10;

  // Cap at 100 for display purposes
  return Math.min(100, Math.round(rawScore));
}

/**
 * Calculate full confidence result with score, topISP, and level
 */
export function calculateConfidence(pings: PingLog[]): ConfidenceResult {
  const score = calculateConfidenceScore(pings);
  const topISP = getTopISP(pings);
  const confidenceLevel = getConfidenceLevel(score);

  return {
    score,
    topISP,
    confidenceLevel,
  };
}

/**
 * Calculate the consistency percentage
 * Returns the percentage of pings that have "good" latency
 */
export function calculateConsistency(
  pings: PingLog[],
  threshold: number = 100
): number {
  const freshPings = filterFreshPings(pings);
  if (freshPings.length === 0) return 0;

  const goodPings = freshPings.filter((p) => p.latencyMs <= threshold);
  return Math.round((goodPings.length / freshPings.length) * 100);
}

/**
 * Get the most common ISP in a set of pings
 * Tie-breaker: If two ISPs have the same count, pick the one with lower avg latency
 */
export function getTopISP(pings: PingLog[]): string {
  const freshPings = filterFreshPings(pings);
  if (freshPings.length === 0) return "No Data";

  // Track count and total latency for each ISP
  const ispStats = new Map<string, { count: number; totalLatency: number }>();

  freshPings.forEach((ping) => {
    const existing = ispStats.get(ping.reportedISP);
    if (existing) {
      existing.count += 1;
      existing.totalLatency += ping.latencyMs;
    } else {
      ispStats.set(ping.reportedISP, {
        count: 1,
        totalLatency: ping.latencyMs,
      });
    }
  });

  let topISP = "No Data";
  let maxCount = 0;
  let bestAvgLatency = Infinity;

  ispStats.forEach((stats, isp) => {
    const avgLatency = stats.totalLatency / stats.count;

    // Higher count wins, or same count with lower latency wins
    if (
      stats.count > maxCount ||
      (stats.count === maxCount && avgLatency < bestAvgLatency)
    ) {
      maxCount = stats.count;
      bestAvgLatency = avgLatency;
      topISP = isp;
    }
  });

  return maxCount > 0 ? topISP : "No Data";
}

/**
 * Get ISP rankings sorted by average latency (fastest first)
 */
export function getISPRankings(
  pings: PingLog[]
): Array<{ isp: string; avgLatency: number; count: number }> {
  const freshPings = filterFreshPings(pings);
  if (freshPings.length === 0) return [];

  const ispData = new Map<string, { total: number; count: number }>();

  freshPings.forEach((ping) => {
    const existing = ispData.get(ping.reportedISP);
    if (existing) {
      existing.total += ping.latencyMs;
      existing.count += 1;
    } else {
      ispData.set(ping.reportedISP, {
        total: ping.latencyMs,
        count: 1,
      });
    }
  });

  const rankings: Array<{ isp: string; avgLatency: number; count: number }> = [];

  ispData.forEach((data, isp) => {
    rankings.push({
      isp,
      avgLatency: Math.round(data.total / data.count),
      count: data.count,
    });
  });

  // Sort by average latency (ascending - fastest first)
  return rankings.sort((a, b) => a.avgLatency - b.avgLatency);
}
