import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mapee_mobile/data/preferences/onboarding_preferences.dart';
import 'package:mapee_mobile/features/onboarding/onboarding_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<void> pumpScreen(
    WidgetTester tester, {
    VoidCallback? onComplete,
    LocationPermissionRequester? requestLocationPermission,
    AppSettingsOpener? openAppSettings,
  }) {
    return tester.pumpWidget(
      CupertinoApp(
        home: OnboardingScreen(
          onComplete: onComplete,
          requestLocationPermission:
              requestLocationPermission ?? () async => PermissionStatus.granted,
          openAppSettings: openAppSettings ?? () async => true,
        ),
      ),
    );
  }

  testWidgets('renders the first explainer page with a Next CTA', (tester) async {
    await pumpScreen(tester);

    expect(find.text('Map real network quality'), findsOneWidget);
    expect(find.text('Next'), findsOneWidget);
    expect(find.text('Skip'), findsOneWidget);
  });

  testWidgets('tapping Next advances through explainer pages to Get Started', (tester) async {
    await pumpScreen(tester);

    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Run a quick test'), findsOneWidget);
    expect(find.text('Next'), findsOneWidget);

    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Your privacy, protected'), findsOneWidget);
    expect(find.text('Get Started'), findsOneWidget);

    await tester.tap(find.text('Get Started'));
    await tester.pumpAndSettle();
    expect(find.text('Enable Location Access'), findsOneWidget);
    expect(find.text('Skip'), findsNothing);
  });

  testWidgets('tapping Skip jumps straight to the permission priming page', (tester) async {
    await pumpScreen(tester);

    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();

    expect(find.text('Enable Location Access'), findsOneWidget);
    expect(find.text('Allow Location Access'), findsOneWidget);
    expect(find.text('Skip'), findsNothing);
  });

  testWidgets('granted permission surfaces Get Started and completes onboarding', (tester) async {
    var completed = false;
    await pumpScreen(
      tester,
      onComplete: () => completed = true,
      requestLocationPermission: () async => PermissionStatus.granted,
    );

    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Allow Location Access'));
    await tester.pumpAndSettle();

    expect(find.text('Get Started'), findsOneWidget);
    expect(completed, isFalse);

    await tester.tap(find.text('Get Started'));
    await tester.pumpAndSettle();

    expect(completed, isTrue);
    const prefs = OnboardingPreferences();
    expect(await prefs.hasCompletedOnboarding, isTrue);
  });

  testWidgets('denied permission offers Try Again and Continue Without Location', (tester) async {
    var completed = false;
    await pumpScreen(
      tester,
      onComplete: () => completed = true,
      requestLocationPermission: () async => PermissionStatus.denied,
    );

    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Allow Location Access'));
    await tester.pumpAndSettle();

    expect(find.text('Try Again'), findsOneWidget);
    expect(find.text('Continue Without Location'), findsOneWidget);

    await tester.tap(find.text('Continue Without Location'));
    await tester.pumpAndSettle();

    expect(completed, isTrue);
  });

  testWidgets('permanently denied permission offers Open Settings', (tester) async {
    var settingsOpened = false;
    await pumpScreen(
      tester,
      requestLocationPermission: () async => PermissionStatus.permanentlyDenied,
      openAppSettings: () async {
        settingsOpened = true;
        return true;
      },
    );

    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Allow Location Access'));
    await tester.pumpAndSettle();

    expect(find.text('Open Settings'), findsOneWidget);
    expect(find.text('Continue Without Location'), findsOneWidget);

    await tester.tap(find.text('Open Settings'));
    await tester.pumpAndSettle();

    expect(settingsOpened, isTrue);
  });
}
