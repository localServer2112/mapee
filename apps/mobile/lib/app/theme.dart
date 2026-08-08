import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../design/tokens/colors.dart';

/// Builds the Material [ThemeData] that carries [MapeeColors] as a
/// [ThemeExtension], so both `CupertinoTheme` (via [cupertinoThemeFor]) and
/// any Material fallback widget read the same semantic source (plan §4.1).
ThemeData materialThemeFor(Brightness brightness) {
  final colors = brightness == Brightness.dark ? MapeeColors.dark : MapeeColors.light;
  return ThemeData(
    brightness: brightness,
    scaffoldBackgroundColor: colors.systemBackground,
    extensions: [colors],
  );
}

CupertinoThemeData cupertinoThemeFor(Brightness brightness) {
  final colors = brightness == Brightness.dark ? MapeeColors.dark : MapeeColors.light;
  return CupertinoThemeData(
    brightness: brightness,
    primaryColor: colors.accent,
    scaffoldBackgroundColor: colors.systemBackground,
    barBackgroundColor: colors.secondaryBackground.withValues(alpha: 0.9),
    textTheme: CupertinoTextThemeData(
      primaryColor: colors.label,
      textStyle: TextStyle(color: colors.label, fontSize: 17),
    ),
  );
}
