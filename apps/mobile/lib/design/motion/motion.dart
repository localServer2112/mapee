import 'package:flutter/widgets.dart';

/// Reduce Motion support (plan §4.3): every animated primitive should consult
/// this rather than hardcoding a duration, so Reduce Motion collapses
/// animations to zero and the HIG 200-350ms guidance is enforced in one place.
class MapeeMotion {
  const MapeeMotion._();

  static const Duration _min = Duration(milliseconds: 200);
  static const Duration _max = Duration(milliseconds: 350);

  static bool reduceMotion(BuildContext context) =>
      MediaQuery.disableAnimationsOf(context);

  static Duration duration(BuildContext context, Duration normal) {
    if (reduceMotion(context)) return Duration.zero;
    if (normal < _min) return _min;
    if (normal > _max) return _max;
    return normal;
  }
}
