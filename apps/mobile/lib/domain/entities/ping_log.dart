/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Minimal port of `packages/core/src/types.ts`'s
/// `PingLog`, trimmed to the fields the confidence algorithms actually use.
class PingLog {
  const PingLog({
    required this.latencyMs,
    required this.reportedIsp,
    required this.timestamp,
  });

  final int latencyMs;
  final String reportedIsp;
  final DateTime timestamp;
}
