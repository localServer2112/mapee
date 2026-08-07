import '../latency.dart';

/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Result of a batch of TCP connect-time probes
/// (plan §6.1): raw per-attempt samples plus the failure count, with
/// `domain/latency.dart`'s statistics already applied so callers get a
/// ready-to-use result instead of raw numbers they'd have to process again.
class LatencyResult {
  const LatencyResult({
    required this.samples,
    required this.failedAttempts,
    required this.averageMs,
    required this.medianMs,
    required this.jitterMs,
    required this.status,
  });

  final List<int> samples;
  final int failedAttempts;
  final int averageMs;
  final int medianMs;
  final int jitterMs;
  final LatencyStatus status;

  bool get hasData => samples.isNotEmpty;
}
