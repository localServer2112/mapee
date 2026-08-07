/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Mirrors the fields of `ScanDetail` from
/// `/v1/me/scans` that the Activity screen actually renders.
class MyScan {
  const MyScan({
    required this.id,
    required this.lat,
    required this.lng,
    required this.ispDisplayName,
    required this.verifiedAsn,
    required this.latencyMs,
    required this.jitterMs,
    required this.uploadMbps,
    required this.downloadMbps,
    required this.isMeasured,
    required this.deviceType,
    required this.timestamp,
  });

  final String id;
  final double lat;
  final double lng;
  final String ispDisplayName;
  final String? verifiedAsn;
  final int latencyMs;
  final int jitterMs;
  final double uploadMbps;
  final double downloadMbps;
  final bool isMeasured;
  final String deviceType;
  final int timestamp;
}
