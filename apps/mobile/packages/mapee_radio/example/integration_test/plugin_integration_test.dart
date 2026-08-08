// This is a basic Flutter integration test.
//
// Since integration tests run in a full Flutter application, they can interact
// with the host side of a plugin implementation, unlike Dart unit tests.
//
// For more information about Flutter integration tests, please see
// https://flutter.dev/to/integration-testing

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:mapee_radio/mapee_radio.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('getRadioInfo does not throw', (WidgetTester tester) async {
    final RadioInfoHostApi api = RadioInfoHostApi();
    // Carrier/RAT are frequently null (no SIM, airplane mode, Simulator,
    // permission not granted) - this only asserts the call round-trips
    // without throwing, not that the fields are non-null.
    final RadioInfo info = await api.getRadioInfo();
    expect(info, isA<RadioInfo>());
  });
}
