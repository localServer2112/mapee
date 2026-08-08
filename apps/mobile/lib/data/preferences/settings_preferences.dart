import 'package:shared_preferences/shared_preferences.dart';

enum DistanceUnits { metric, imperial }

/// Typed wrapper around [SharedPreferences] for user-facing app settings
/// (plan §5 Phase 5), so screens don't sprinkle raw string keys.
class SettingsPreferences {
  const SettingsPreferences();

  static const _dataSaverKey = 'settings.data_saver_enabled';
  static const _unitsKey = 'settings.units';

  Future<bool> get dataSaverEnabled async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_dataSaverKey) ?? false;
  }

  Future<void> setDataSaverEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_dataSaverKey, value);
  }

  Future<DistanceUnits> get units async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_unitsKey) == 'imperial' ? DistanceUnits.imperial : DistanceUnits.metric;
  }

  Future<void> setUnits(DistanceUnits value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_unitsKey, value == DistanceUnits.imperial ? 'imperial' : 'metric');
  }
}
