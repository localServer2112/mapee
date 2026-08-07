import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mapee_mobile/main.dart';

void main() {
  testWidgets('renders the tab shell with Map, Activity, and Insights tabs', (tester) async {
    SharedPreferences.setMockInitialValues({'onboarding.hasCompletedOnboarding': true});

    await tester.pumpWidget(const ProviderScope(child: MapeeApp()));
    await tester.pump();
    await tester.pump();

    expect(find.text('Map'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
    expect(find.text('Insights'), findsOneWidget);
  });

  testWidgets('shows onboarding on first launch', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const ProviderScope(child: MapeeApp()));
    await tester.pump();
    await tester.pump();

    expect(find.text('Map real network quality'), findsOneWidget);
    expect(find.text('Map'), findsNothing);
  });
}
