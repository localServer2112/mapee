/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Result of a real, timed HTTP transfer (plan
/// §6.2): `downloadMbps`/`uploadMbps` are null whenever no real transfer
/// produced a trustworthy figure — there is no fallback path anywhere that
/// derives or estimates a number in their place, only `outcome` explaining
/// why the figure is missing.
enum ThroughputOutcome { success, budgetExceeded, cellularConsentDenied, networkError, timeout }

class ThroughputResult {
  const ThroughputResult({
    required this.outcome,
    this.downloadMbps,
    this.uploadMbps,
    this.bytesTransferred = 0,
    this.elapsed = Duration.zero,
  });

  final ThroughputOutcome outcome;
  final double? downloadMbps;
  final double? uploadMbps;
  final int bytesTransferred;
  final Duration elapsed;

  bool get isSuccess => outcome == ThroughputOutcome.success;
}
