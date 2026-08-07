import 'package:flutter/services.dart';

/// Thin wrapper around [HapticFeedback] (plan §4.3) so call sites never
/// import `flutter/services.dart` directly. Currently absent entirely from
/// the legacy web app; this establishes the pattern for later phases.
class MapeeHaptics {
  const MapeeHaptics._();

  static void selectionClick() => HapticFeedback.selectionClick();

  static void success() => HapticFeedback.mediumImpact();

  static void warning() => HapticFeedback.heavyImpact();
}
