import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mapee_mobile/data/preferences/onboarding_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('OnboardingPreferences', () {
    test('defaults to false when nothing has been stored', () async {
      const prefs = OnboardingPreferences();
      expect(await prefs.hasCompletedOnboarding, isFalse);
    });

    test('persists true after setCompletedOnboarding(true)', () async {
      const prefs = OnboardingPreferences();
      await prefs.setCompletedOnboarding(true);
      expect(await prefs.hasCompletedOnboarding, isTrue);
    });

    test('persists false after setCompletedOnboarding(false)', () async {
      const prefs = OnboardingPreferences();
      await prefs.setCompletedOnboarding(true);
      await prefs.setCompletedOnboarding(false);
      expect(await prefs.hasCompletedOnboarding, isFalse);
    });

    test('a fresh instance reads back a value persisted by another instance', () async {
      const writer = OnboardingPreferences();
      await writer.setCompletedOnboarding(true);

      const reader = OnboardingPreferences();
      expect(await reader.hasCompletedOnboarding, isTrue);
    });
  });
}
