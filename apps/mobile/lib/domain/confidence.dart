import 'dart:math' as math;

import 'constants.dart';
import 'entities/ping_log.dart';
import 'latency.dart';

/// Confidence Algorithm
///
/// Score = (Unique pings in area) x (1 / StdDev of Latency)
///
/// Data Freshness Weights:
///   < 7 days:  1.0
///   7-30 days: 0.5
///   > 30 days: ignored
enum ConfidenceLevel { high, medium, low }

class ConfidenceResult {
  const ConfidenceResult({
    required this.score,
    required this.topISP,
    required this.confidenceLevel,
  });

  final int score;
  final String topISP;
  final ConfidenceLevel confidenceLevel;
}

class IspRanking {
  const IspRanking({required this.isp, required this.avgLatency, required this.count});

  final String isp;
  final int avgLatency;
  final int count;
}

double getFreshnessWeight(DateTime timestamp) {
  final ageMs = DateTime.now().difference(timestamp).inMilliseconds;
  final ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= DataFreshness.freshDays) {
    return 1.0;
  } else if (ageDays <= DataFreshness.staleDays) {
    return 0.5;
  } else {
    return 0;
  }
}

List<PingLog> filterFreshPings(List<PingLog> pings) {
  return pings.where((ping) => getFreshnessWeight(ping.timestamp) > 0).toList();
}

int calculateWeightedAverageLatency(List<PingLog> pings) {
  final freshPings = filterFreshPings(pings);
  if (freshPings.isEmpty) return 0;

  var totalWeight = 0.0;
  var weightedSum = 0.0;

  for (final ping in freshPings) {
    final weight = getFreshnessWeight(ping.timestamp);
    weightedSum += ping.latencyMs * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? (weightedSum / totalWeight).round() : 0;
}

ConfidenceLevel getConfidenceLevel(int score) {
  if (score >= 70) return ConfidenceLevel.high;
  if (score >= 40) return ConfidenceLevel.medium;
  return ConfidenceLevel.low;
}

/// Calculate the confidence score for a set of pings.
///
/// Higher score = more reliable data. Score considers: number of pings,
/// consistency (low std dev), freshness.
int calculateConfidenceScore(List<PingLog> pings) {
  final freshPings = filterFreshPings(pings);
  if (freshPings.isEmpty) return 0;

  var weightedCount = 0.0;
  for (final ping in freshPings) {
    weightedCount += getFreshnessWeight(ping.timestamp);
  }

  final latencies = freshPings.map((p) => p.latencyMs).toList();
  final jitter = calculateJitter(latencies);
  final consistencyFactor = 1 / (jitter + 1);

  final rawScore = weightedCount * consistencyFactor * 10;

  return math.min(100, rawScore.round());
}

ConfidenceResult calculateConfidence(List<PingLog> pings) {
  final score = calculateConfidenceScore(pings);
  final topISP = getTopISP(pings);
  final confidenceLevel = getConfidenceLevel(score);

  return ConfidenceResult(score: score, topISP: topISP, confidenceLevel: confidenceLevel);
}

/// Percentage of fresh pings with latency at or under [threshold].
int calculateConsistency(List<PingLog> pings, [int threshold = 100]) {
  final freshPings = filterFreshPings(pings);
  if (freshPings.isEmpty) return 0;

  final goodPings = freshPings.where((p) => p.latencyMs <= threshold);
  return (goodPings.length / freshPings.length * 100).round();
}

class _IspStats {
  _IspStats(this.count, this.totalLatency);
  int count;
  int totalLatency;
}

/// Most common ISP among fresh pings. Tie-breaker: equal counts resolve to
/// the lower average latency.
String getTopISP(List<PingLog> pings) {
  final freshPings = filterFreshPings(pings);
  if (freshPings.isEmpty) return 'No Data';

  final ispStats = <String, _IspStats>{};

  for (final ping in freshPings) {
    final existing = ispStats[ping.reportedIsp];
    if (existing != null) {
      existing.count += 1;
      existing.totalLatency += ping.latencyMs;
    } else {
      ispStats[ping.reportedIsp] = _IspStats(1, ping.latencyMs);
    }
  }

  var topISP = 'No Data';
  var maxCount = 0;
  var bestAvgLatency = double.infinity;

  ispStats.forEach((isp, stats) {
    final avgLatency = stats.totalLatency / stats.count;

    if (stats.count > maxCount || (stats.count == maxCount && avgLatency < bestAvgLatency)) {
      maxCount = stats.count;
      bestAvgLatency = avgLatency;
      topISP = isp;
    }
  });

  return maxCount > 0 ? topISP : 'No Data';
}

class _IspTotals {
  _IspTotals(this.total, this.count);
  int total;
  int count;
}

/// ISP rankings sorted by average latency (fastest first).
List<IspRanking> getISPRankings(List<PingLog> pings) {
  final freshPings = filterFreshPings(pings);
  if (freshPings.isEmpty) return [];

  final ispData = <String, _IspTotals>{};

  for (final ping in freshPings) {
    final existing = ispData[ping.reportedIsp];
    if (existing != null) {
      existing.total += ping.latencyMs;
      existing.count += 1;
    } else {
      ispData[ping.reportedIsp] = _IspTotals(ping.latencyMs, 1);
    }
  }

  final rankings = <IspRanking>[
    for (final entry in ispData.entries)
      IspRanking(
        isp: entry.key,
        avgLatency: (entry.value.total / entry.value.count).round(),
        count: entry.value.count,
      ),
  ];

  rankings.sort((a, b) => a.avgLatency - b.avgLatency);
  return rankings;
}
