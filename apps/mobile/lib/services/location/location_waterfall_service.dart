import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../../domain/entities/location_fix.dart';

typedef PermissionChecker = Future<LocationPermission> Function();
typedef ServiceEnabledChecker = Future<bool> Function();
typedef CurrentPositionFetcher = Future<Position> Function({
  LocationSettings? locationSettings,
});
typedef LastKnownPositionFetcher = Future<Position?> Function();

Future<LocationPermission> _defaultCheckPermission() => Geolocator.checkPermission();

Future<bool> _defaultIsLocationServiceEnabled() => Geolocator.isLocationServiceEnabled();

Future<Position> _defaultGetCurrentPosition({LocationSettings? locationSettings}) =>
    Geolocator.getCurrentPosition(locationSettings: locationSettings);

Future<Position?> _defaultGetLastKnownPosition() => Geolocator.getLastKnownPosition();

class LocationWaterfallService {
  LocationWaterfallService({
    PermissionChecker? checkPermission,
    ServiceEnabledChecker? isLocationServiceEnabled,
    CurrentPositionFetcher? getCurrentPosition,
    LastKnownPositionFetcher? getLastKnownPosition,
  })  : _checkPermission = checkPermission ?? _defaultCheckPermission,
        _isLocationServiceEnabled = isLocationServiceEnabled ?? _defaultIsLocationServiceEnabled,
        _getCurrentPosition = getCurrentPosition ?? _defaultGetCurrentPosition,
        _getLastKnownPosition = getLastKnownPosition ?? _defaultGetLastKnownPosition;

  final PermissionChecker _checkPermission;
  final ServiceEnabledChecker _isLocationServiceEnabled;
  final CurrentPositionFetcher _getCurrentPosition;
  final LastKnownPositionFetcher _getLastKnownPosition;

  Future<LocationFix> getCurrentLocation({Duration timeout = const Duration(seconds: 10)}) async {
    final permission = await _checkPermission();
    final granted =
        permission == LocationPermission.whileInUse || permission == LocationPermission.always;
    if (!granted || !await _isLocationServiceEnabled()) {
      return LocationFix.unavailable;
    }

    try {
      final position = await _getCurrentPosition(
        locationSettings: LocationSettings(accuracy: LocationAccuracy.high, timeLimit: timeout),
      );
      return LocationFix(
        lat: position.latitude,
        lng: position.longitude,
        accuracyMeters: position.accuracy,
        source: LocationSource.gps,
      );
    } catch (_) {
      // Fall through to the coarse fallback below.
    }

    // Falling back to the device's cached last-known fix rather than a
    // second getCurrentPosition() call at reduced accuracy: a fresh fix
    // (at any accuracy) still needs a GPS/network round trip that can time
    // out again for the same reason attempt 1 did, whereas the cached fix
    // returns immediately, trading recency for speed.
    try {
      final lastKnown = await _getLastKnownPosition();
      if (lastKnown != null) {
        return LocationFix(
          lat: lastKnown.latitude,
          lng: lastKnown.longitude,
          accuracyMeters: lastKnown.accuracy,
          source: LocationSource.coarse,
        );
      }
    } catch (_) {
      // Falls through to unavailable below.
    }

    // No IP-based geolocation fallback: apps/api has no endpoint that
    // resolves a location from an IP address, so there is nothing to call
    // here short of a fabricated guess, which is explicitly disallowed.
    return LocationFix.unavailable;
  }
}
