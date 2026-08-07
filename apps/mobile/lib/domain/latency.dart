import 'dart:math' as math;

import 'constants.dart';

enum LatencyStatus { good, fair, poor }

LatencyStatus getLatencyStatus(int latencyMs) {
  if (latencyMs <= LatencyThresholds.good) return LatencyStatus.good;
  if (latencyMs <= LatencyThresholds.fair) return LatencyStatus.fair;
  return LatencyStatus.poor;
}

String getLatencyLabel(LatencyStatus status) {
  switch (status) {
    case LatencyStatus.good:
      return 'Excellent';
    case LatencyStatus.fair:
      return 'Average';
    case LatencyStatus.poor:
      return 'Poor';
  }
}

int calculateAverageLatency(List<int> latencies) {
  if (latencies.isEmpty) return 0;
  final sum = latencies.reduce((acc, val) => acc + val);
  return (sum / latencies.length).round();
}

int calculateMedianLatency(List<int> latencies) {
  if (latencies.isEmpty) return 0;
  final sorted = [...latencies]..sort();
  final mid = sorted.length ~/ 2;
  return sorted.length % 2 != 0
      ? sorted[mid]
      : ((sorted[mid - 1] + sorted[mid]) / 2).round();
}

int calculateJitter(List<int> latencies) {
  if (latencies.length < 2) return 0;
  final mean = latencies.reduce((a, b) => a + b) / latencies.length;
  final squaredDiffs = latencies.map((val) => math.pow(val - mean, 2));
  final variance = squaredDiffs.reduce((a, b) => a + b) / latencies.length;
  return math.sqrt(variance).round();
}
