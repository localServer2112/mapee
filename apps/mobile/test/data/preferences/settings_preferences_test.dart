import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mapee_mobile/data/preferences/settings_preferences.dart';

void main() {
  late SettingsPreferences preferences;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    preferences = const SettingsPreferences();
  });

  test('dataSaverEnabled defaults to false', () async {
    expect(await preferences.dataSaverEnabled, isFalse);
  });

  test('setDataSaverEnabled persists the value', () async {
    await preferences.setDataSaverEnabled(true);
    expect(await preferences.dataSaverEnabled, isTrue);

    await preferences.setDataSaverEnabled(false);
    expect(await preferences.dataSaverEnabled, isFalse);
  });

  test('units defaults to metric', () async {
    expect(await preferences.units, DistanceUnits.metric);
  });

  test('setUnits persists the value', () async {
    await preferences.setUnits(DistanceUnits.imperial);
    expect(await preferences.units, DistanceUnits.imperial);

    await preferences.setUnits(DistanceUnits.metric);
    expect(await preferences.units, DistanceUnits.metric);
  });

  test('an unrecognised stored units value falls back to metric', () async {
    SharedPreferences.setMockInitialValues({'settings.units': 'bogus'});
    expect(await preferences.units, DistanceUnits.metric);
  });
}
