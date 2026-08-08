import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mapee_mobile/domain/entities/location_fix.dart';
import 'package:mapee_mobile/services/location/location_waterfall_service.dart';

Position _position({
  required double lat,
  required double lng,
  required double accuracy,
}) {
  return Position(
    latitude: lat,
    longitude: lng,
    timestamp: DateTime.utc(2026, 1, 1),
    accuracy: accuracy,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}

void main() {
  group('LocationWaterfallService', () {
    test('returns a gps fix when the high-accuracy attempt succeeds', () async {
      final service = LocationWaterfallService(
        checkPermission: () async => LocationPermission.whileInUse,
        isLocationServiceEnabled: () async => true,
        getCurrentPosition: ({locationSettings}) async =>
            _position(lat: 6.5244, lng: 3.3792, accuracy: 12),
        getLastKnownPosition: () async =>
            fail('getLastKnownPosition should not be called when GPS succeeds'),
      );

      final fix = await service.getCurrentLocation();

      expect(fix.source, LocationSource.gps);
      expect(fix.lat, 6.5244);
      expect(fix.lng, 3.3792);
      expect(fix.accuracyMeters, 12);
    });

    test('falls back to the last-known position when GPS times out', () async {
      final service = LocationWaterfallService(
        checkPermission: () async => LocationPermission.whileInUse,
        isLocationServiceEnabled: () async => true,
        getCurrentPosition: ({locationSettings}) async =>
            throw TimeoutException('no fix within time limit'),
        getLastKnownPosition: () async =>
            _position(lat: 9.0765, lng: 7.3986, accuracy: 800),
      );

      final fix = await service.getCurrentLocation();

      expect(fix.source, LocationSource.coarse);
      expect(fix.lat, 9.0765);
      expect(fix.lng, 7.3986);
      expect(fix.accuracyMeters, 800);
    });

    test('falls back to the last-known position when GPS throws', () async {
      final service = LocationWaterfallService(
        checkPermission: () async => LocationPermission.whileInUse,
        isLocationServiceEnabled: () async => true,
        getCurrentPosition: ({locationSettings}) async =>
            throw const LocationServiceDisabledException(),
        getLastKnownPosition: () async =>
            _position(lat: 4.8156, lng: 7.0498, accuracy: 650),
      );

      final fix = await service.getCurrentLocation();

      expect(fix.source, LocationSource.coarse);
      expect(fix.lat, 4.8156);
      expect(fix.lng, 7.0498);
    });

    test(
        'returns unavailable without attempting GPS when permission is denied',
        () async {
      var gpsCalled = false;
      final service = LocationWaterfallService(
        checkPermission: () async => LocationPermission.denied,
        isLocationServiceEnabled: () async => true,
        getCurrentPosition: ({locationSettings}) async {
          gpsCalled = true;
          return _position(lat: 0, lng: 0, accuracy: 0);
        },
        getLastKnownPosition: () async =>
            fail('getLastKnownPosition should not be called when permission is denied'),
      );

      final fix = await service.getCurrentLocation();

      expect(fix.source, LocationSource.unavailable);
      expect(fix.lat.isNaN, isTrue);
      expect(fix.lng.isNaN, isTrue);
      expect(gpsCalled, isFalse);
    });

    test(
        'returns unavailable without attempting GPS when permission is permanently denied',
        () async {
      var gpsCalled = false;
      final service = LocationWaterfallService(
        checkPermission: () async => LocationPermission.deniedForever,
        isLocationServiceEnabled: () async => true,
        getCurrentPosition: ({locationSettings}) async {
          gpsCalled = true;
          return _position(lat: 0, lng: 0, accuracy: 0);
        },
        getLastKnownPosition: () async => null,
      );

      final fix = await service.getCurrentLocation();

      expect(fix.source, LocationSource.unavailable);
      expect(gpsCalled, isFalse);
    });

    test('returns unavailable when GPS fails and no last-known fix exists', () async {
      final service = LocationWaterfallService(
        checkPermission: () async => LocationPermission.whileInUse,
        isLocationServiceEnabled: () async => true,
        getCurrentPosition: ({locationSettings}) async =>
            throw TimeoutException('no fix within time limit'),
        getLastKnownPosition: () async => null,
      );

      final fix = await service.getCurrentLocation();

      expect(fix.source, LocationSource.unavailable);
      expect(fix.lat.isNaN, isTrue);
      expect(fix.lng.isNaN, isTrue);
    });

    test('returns unavailable without attempting GPS when location services are disabled', () async {
      var gpsCalled = false;
      final service = LocationWaterfallService(
        checkPermission: () async => LocationPermission.whileInUse,
        isLocationServiceEnabled: () async => false,
        getCurrentPosition: ({locationSettings}) async {
          gpsCalled = true;
          return _position(lat: 0, lng: 0, accuracy: 0);
        },
        getLastKnownPosition: () async => null,
      );

      final fix = await service.getCurrentLocation();

      expect(fix.source, LocationSource.unavailable);
      expect(gpsCalled, isFalse);
    });
  });
}
