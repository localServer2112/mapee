/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Named `GeocodeLocation`, not `GeocodeResult`,
/// to avoid colliding with the generated client's model of the same name.
class GeocodeLocation {
  const GeocodeLocation({required this.displayName, required this.lat, required this.lng});

  final String displayName;
  final double lat;
  final double lng;
}
