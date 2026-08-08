import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

import 'package:mapee_mobile/domain/entities/location_fix.dart';
import 'package:mapee_mobile/features/scan/location_step.dart';
import 'package:mapee_mobile/services/location/location_waterfall_service.dart';

Position _position({required double accuracy}) {
  return Position(
    latitude: 6.5244,
    longitude: 3.3792,
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

LocationWaterfallService _availableService({double accuracy = 15}) {
  return LocationWaterfallService(
    checkPermission: () async => LocationPermission.whileInUse,
    isLocationServiceEnabled: () async => true,
    getCurrentPosition: ({locationSettings}) async => _position(accuracy: accuracy),
    getLastKnownPosition: () async => null,
  );
}

LocationWaterfallService _unavailableService() {
  return LocationWaterfallService(
    checkPermission: () async => LocationPermission.denied,
    isLocationServiceEnabled: () async => true,
    getCurrentPosition: ({locationSettings}) async =>
        fail('getCurrentPosition should not be called when permission is denied'),
    getLastKnownPosition: () async =>
        fail('getLastKnownPosition should not be called when permission is denied'),
  );
}

Future<void> _pumpLocationStep(
  WidgetTester tester, {
  required LocationWaterfallService service,
  void Function(LocationFix)? onConfirmed,
  VoidCallback? onCancel,
  AppSettingsOpener? openAppSettings,
}) {
  return tester.pumpWidget(
    CupertinoApp(
      home: LocationStep(
        onConfirmed: onConfirmed ?? (_) {},
        onCancel: onCancel ?? () {},
        locationService: service,
        openAppSettings: openAppSettings,
      ),
    ),
  );
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets(
    'available fix renders the map preview, accuracy caption, and both actions',
    (tester) async {
      await _pumpLocationStep(tester, service: _availableService(accuracy: 15));
      await _settle(tester);

      expect(find.byKey(const Key('location-step-map')), findsOneWidget);
      expect(find.text('Accurate to ~15m'), findsOneWidget);
      expect(find.text('This looks right'), findsOneWidget);
      expect(find.text('Adjust location'), findsOneWidget);
    },
  );

  testWidgets('poor accuracy renders honest low-accuracy phrasing', (tester) async {
    await _pumpLocationStep(tester, service: _availableService(accuracy: 150));
    await _settle(tester);

    expect(find.text('Low accuracy (~150m)'), findsOneWidget);
  });

  testWidgets('tapping "This looks right" calls onConfirmed with the exact fix', (tester) async {
    LocationFix? confirmed;
    await _pumpLocationStep(
      tester,
      service: _availableService(accuracy: 12),
      onConfirmed: (fix) => confirmed = fix,
    );
    await _settle(tester);

    await tester.tap(find.text('This looks right'));
    await tester.pump();

    expect(confirmed, isNotNull);
    expect(confirmed!.lat, 6.5244);
    expect(confirmed!.lng, 3.3792);
    expect(confirmed!.accuracyMeters, 12);
    expect(confirmed!.source, LocationSource.gps);
  });

  testWidgets(
    'unavailable fix renders an honest error state, not a fake map',
    (tester) async {
      await _pumpLocationStep(tester, service: _unavailableService());
      await _settle(tester);

      expect(find.text('Location Unavailable'), findsOneWidget);
      expect(find.byKey(const Key('location-step-map')), findsNothing);
      expect(find.text('This looks right'), findsNothing);
      expect(find.text('Try Again'), findsOneWidget);
      expect(find.text('Open Settings'), findsOneWidget);
    },
  );

  testWidgets('tapping "Try Again" retries getCurrentLocation', (tester) async {
    var attempts = 0;
    final service = LocationWaterfallService(
      checkPermission: () async {
        attempts++;
        return attempts == 1 ? LocationPermission.denied : LocationPermission.whileInUse;
      },
      isLocationServiceEnabled: () async => true,
      getCurrentPosition: ({locationSettings}) async => _position(accuracy: 20),
      getLastKnownPosition: () async => null,
    );

    await _pumpLocationStep(tester, service: service);
    await _settle(tester);
    expect(find.text('Location Unavailable'), findsOneWidget);

    await tester.tap(find.text('Try Again'));
    await _settle(tester);

    expect(find.text('Accurate to ~20m'), findsOneWidget);
    expect(attempts, 2);
  });

  testWidgets('tapping "Open Settings" invokes the injected opener', (tester) async {
    var opened = false;
    await _pumpLocationStep(
      tester,
      service: _unavailableService(),
      openAppSettings: () async {
        opened = true;
        return true;
      },
    );
    await _settle(tester);

    await tester.tap(find.text('Open Settings'));
    await tester.pump();

    expect(opened, isTrue);
  });

  testWidgets('tapping "Adjust location" switches to draggable-pin mode', (tester) async {
    await _pumpLocationStep(tester, service: _availableService());
    await _settle(tester);

    await tester.tap(find.text('Adjust location'));
    await _settle(tester);

    expect(find.text('Use this location'), findsOneWidget);
    expect(find.text('This looks right'), findsNothing);
    expect(find.byKey(const Key('location-step-map')), findsOneWidget);
  });

  testWidgets('"Use this location" confirms with the original accuracy figure', (tester) async {
    LocationFix? confirmed;
    await _pumpLocationStep(
      tester,
      service: _availableService(accuracy: 18),
      onConfirmed: (fix) => confirmed = fix,
    );
    await _settle(tester);

    await tester.tap(find.text('Adjust location'));
    await _settle(tester);
    await tester.tap(find.text('Use this location'));
    await tester.pump();

    expect(confirmed, isNotNull);
    expect(confirmed!.accuracyMeters, 18);
  });
}
