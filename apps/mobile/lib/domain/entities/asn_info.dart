/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Mirrors `packages/core/src/types.ts`'s `ASNInfo`.
class AsnInfo {
  const AsnInfo({
    required this.isp,
    required this.as,
    required this.asname,
    required this.org,
  });

  final String isp;
  final String as;
  final String asname;
  final String org;
}
