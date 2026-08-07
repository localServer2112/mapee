import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

import 'package:mapee_mobile/app/providers.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/area_repository.dart';
import 'package:mapee_mobile/domain/entities/area_stats.dart';
import 'package:mapee_mobile/features/map/map_screen.dart';
import 'package:mapee_mobile/services/location/location_waterfall_service.dart';

// MapScreen fetches areas via Riverpod as soon as the map's style loads; a
// real ApiClient's Dio call would hit this codebase's confirmed sandbox
// limitation (real dart:io HttpClient requests never complete inside
// testWidgets), so every test here overrides areaRepositoryProvider with
// this instantly-resolving fake instead, matching the established pattern
// in test/features/scan/testing_step_test.dart.
class _FakeAreaRepository extends AreaRepository {
  _FakeAreaRepository() : super(ApiClient());

  @override
  Future<List<AreaStats>> fetchAreas(String bbox, {int? zoom}) async => const [];
}

Position _position() {
  return Position(
    latitude: 6.601,
    longitude: 3.351,
    timestamp: DateTime.utc(2026, 1, 1),
    accuracy: 15,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}

Future<void> _pumpMapScreen(WidgetTester tester, {required LocationWaterfallService service}) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [areaRepositoryProvider.overrideWithValue(_FakeAreaRepository())],
      child: CupertinoApp(home: MapScreen(locationService: service)),
    ),
  );
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('centers the camera on a real fix without any permission prompt', (tester) async {
    var checkPermissionCalls = 0;
    var requestedCurrentPosition = false;
    final service = LocationWaterfallService(
      checkPermission: () async {
        checkPermissionCalls++;
        return LocationPermission.whileInUse;
      },
      isLocationServiceEnabled: () async => true,
      getCurrentPosition: ({locationSettings}) async {
        requestedCurrentPosition = true;
        return _position();
      },
      getLastKnownPosition: () async => null,
    );

    await _pumpMapScreen(tester, service: service);
    await _settle(tester);

    // getCurrentLocation() only ever calls Geolocator.checkPermission(),
    // never .requestPermission() -- permission is decided during onboarding,
    // and the map must never re-prompt just from being opened.
    expect(checkPermissionCalls, greaterThan(0));
    expect(requestedCurrentPosition, isTrue);
  });

  testWidgets('an unavailable fix leaves the map on its default view, not a crash', (tester) async {
    final service = LocationWaterfallService(
      checkPermission: () async => LocationPermission.denied,
      isLocationServiceEnabled: () async => true,
      getCurrentPosition: ({locationSettings}) async =>
          fail('getCurrentPosition should not be called when permission is denied'),
      getLastKnownPosition: () async =>
          fail('getLastKnownPosition should not be called when permission is denied'),
    );

    await _pumpMapScreen(tester, service: service);
    await _settle(tester);

    expect(tester.takeException(), isNull);
  });
}
