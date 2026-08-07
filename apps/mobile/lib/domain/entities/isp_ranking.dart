/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Mirrors `ISPRanking` from `/v1/isp-rankings`.
class IspRanking {
  const IspRanking({
    required this.isp,
    required this.avgLatencyMs,
    required this.medianLatencyMs,
    required this.avgJitterMs,
    required this.sampleCount,
    required this.avgDownloadMbps,
    required this.avgUploadMbps,
  });

  final String isp;
  final int avgLatencyMs;
  final int medianLatencyMs;
  final int avgJitterMs;
  final int sampleCount;
  final double avgDownloadMbps;
  final double avgUploadMbps;
}
