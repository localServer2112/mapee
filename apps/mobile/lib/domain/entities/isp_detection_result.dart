/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Result of `IspDetector.detect` (plan §Track B
/// Phase 3 "ISP matcher with OS/ASN dual source"): the best-guess ISP name,
/// plus which source actually produced it.
enum IspDetectionSource { osCarrierName, asnLookup, none }

class IspDetectionResult {
  const IspDetectionResult({required this.ispName, required this.source});

  final String? ispName;
  final IspDetectionSource source;
}
