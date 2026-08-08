/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import, so features never depend on wire shapes
/// directly. Mirrors `packages/contracts/src/schemas/area.ts`'s `Area`.
class AreaStats {
  const AreaStats({
    required this.hexId,
    required this.centerLat,
    required this.centerLng,
    required this.avgLatencyMs,
    required this.minLatencyMs,
    required this.maxLatencyMs,
    required this.pingCount,
    required this.topIsp,
    required this.confidenceScore,
    required this.consistency,
  });

  final String hexId;
  final double centerLat;
  final double centerLng;
  final int avgLatencyMs;
  final int minLatencyMs;
  final int maxLatencyMs;
  final int pingCount;
  final String topIsp;
  final int confidenceScore;
  final int consistency;

  /// Quality tier for `MapeeColors` (plan §4.1's six tiers). Latency-only
  /// for now — the web app's existing bands, ported as-is; §12.4's
  /// per-metric tier refinement is a design-system follow-up, not part of
  /// this vertical slice.
  AreaQuality get quality {
    if (avgLatencyMs <= 50) return AreaQuality.excellent;
    if (avgLatencyMs <= 100) return AreaQuality.good;
    if (avgLatencyMs <= 200) return AreaQuality.fair;
    if (avgLatencyMs <= 400) return AreaQuality.usable;
    return AreaQuality.poor;
  }
}

enum AreaQuality { excellent, good, fair, usable, poor, unknown }
