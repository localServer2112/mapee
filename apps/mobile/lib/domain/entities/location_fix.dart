/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Result of `LocationWaterfallService`'s GPS →
/// coarse → unavailable escalation (plan §6.4), so downstream code (e.g. a
/// scan submission) can tell how much to trust the fix.
class LocationFix {
  const LocationFix({
    required this.lat,
    required this.lng,
    required this.accuracyMeters,
    required this.source,
  });

  /// `lat`/`lng`/`accuracyMeters` are `double.nan`, never a guessed
  /// coordinate — a genuinely unavailable fix must not look like real data.
  static const unavailable = LocationFix(
    lat: double.nan,
    lng: double.nan,
    accuracyMeters: double.nan,
    source: LocationSource.unavailable,
  );

  final double lat;
  final double lng;
  final double accuracyMeters;
  final LocationSource source;

  bool get isAvailable => source != LocationSource.unavailable;
}

enum LocationSource { gps, coarse, unavailable }
