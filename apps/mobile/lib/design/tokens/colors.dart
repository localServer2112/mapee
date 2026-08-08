import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart' show Theme, ThemeExtension;

/// Semantic colour tokens (plan §4.1). Every colour in the app should read
/// from here rather than a hardcoded value, so light/dark and future palette
/// changes are one edit. Six quality tiers, not five: "unknown" (no data
/// yet) must look different from "poor" (bad data), which today's web app
/// collapses into the same "render nothing" case.
class MapeeColors extends ThemeExtension<MapeeColors> {
  const MapeeColors({
    required this.label,
    required this.secondaryLabel,
    required this.tertiaryLabel,
    required this.systemBackground,
    required this.secondaryBackground,
    required this.tertiaryBackground,
    required this.separator,
    required this.accent,
    required this.qualityExcellent,
    required this.qualityGood,
    required this.qualityFair,
    required this.qualityUsable,
    required this.qualityPoor,
    required this.qualityUnknown,
  });

  final Color label;
  final Color secondaryLabel;
  final Color tertiaryLabel;
  final Color systemBackground;
  final Color secondaryBackground;
  final Color tertiaryBackground;
  final Color separator;
  final Color accent;

  final Color qualityExcellent;
  final Color qualityGood;
  final Color qualityFair;
  final Color qualityUsable;
  final Color qualityPoor;
  final Color qualityUnknown;

  static const light = MapeeColors(
    label: CupertinoColors.black,
    secondaryLabel: Color(0xFF3C3C43),
    tertiaryLabel: Color(0xFF3C3C43),
    systemBackground: CupertinoColors.white,
    secondaryBackground: Color(0xFFF2F2F7),
    tertiaryBackground: Color(0xFFFFFFFF),
    separator: Color(0x5CC6C6C8),
    accent: Color(0xFF0A84FF),
    qualityExcellent: Color(0xFF34C759),
    qualityGood: Color(0xFF30B0C7),
    qualityFair: Color(0xFFFFCC00),
    qualityUsable: Color(0xFFFF9500),
    qualityPoor: Color(0xFFFF3B30),
    qualityUnknown: Color(0xFFC7C7CC),
  );

  static const dark = MapeeColors(
    label: CupertinoColors.white,
    secondaryLabel: Color(0xFFAEAEB2),
    tertiaryLabel: Color(0xFF8E8E93),
    systemBackground: CupertinoColors.black,
    secondaryBackground: Color(0xFF1C1C1E),
    tertiaryBackground: Color(0xFF2C2C2E),
    separator: Color(0x5C38383A),
    accent: Color(0xFF409CFF),
    qualityExcellent: Color(0xFF30D158),
    qualityGood: Color(0xFF40C8E0),
    qualityFair: Color(0xFFFFD60A),
    qualityUsable: Color(0xFFFF9F0A),
    qualityPoor: Color(0xFFFF453A),
    qualityUnknown: Color(0xFF48484A),
  );

  static MapeeColors of(BuildContext context) =>
      Theme.of(context).extension<MapeeColors>() ?? light;

  @override
  MapeeColors copyWith({
    Color? label,
    Color? secondaryLabel,
    Color? tertiaryLabel,
    Color? systemBackground,
    Color? secondaryBackground,
    Color? tertiaryBackground,
    Color? separator,
    Color? accent,
    Color? qualityExcellent,
    Color? qualityGood,
    Color? qualityFair,
    Color? qualityUsable,
    Color? qualityPoor,
    Color? qualityUnknown,
  }) {
    return MapeeColors(
      label: label ?? this.label,
      secondaryLabel: secondaryLabel ?? this.secondaryLabel,
      tertiaryLabel: tertiaryLabel ?? this.tertiaryLabel,
      systemBackground: systemBackground ?? this.systemBackground,
      secondaryBackground: secondaryBackground ?? this.secondaryBackground,
      tertiaryBackground: tertiaryBackground ?? this.tertiaryBackground,
      separator: separator ?? this.separator,
      accent: accent ?? this.accent,
      qualityExcellent: qualityExcellent ?? this.qualityExcellent,
      qualityGood: qualityGood ?? this.qualityGood,
      qualityFair: qualityFair ?? this.qualityFair,
      qualityUsable: qualityUsable ?? this.qualityUsable,
      qualityPoor: qualityPoor ?? this.qualityPoor,
      qualityUnknown: qualityUnknown ?? this.qualityUnknown,
    );
  }

  @override
  MapeeColors lerp(MapeeColors? other, double t) {
    if (other is! MapeeColors) return this;
    return MapeeColors(
      label: Color.lerp(label, other.label, t)!,
      secondaryLabel: Color.lerp(secondaryLabel, other.secondaryLabel, t)!,
      tertiaryLabel: Color.lerp(tertiaryLabel, other.tertiaryLabel, t)!,
      systemBackground: Color.lerp(systemBackground, other.systemBackground, t)!,
      secondaryBackground: Color.lerp(secondaryBackground, other.secondaryBackground, t)!,
      tertiaryBackground: Color.lerp(tertiaryBackground, other.tertiaryBackground, t)!,
      separator: Color.lerp(separator, other.separator, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      qualityExcellent: Color.lerp(qualityExcellent, other.qualityExcellent, t)!,
      qualityGood: Color.lerp(qualityGood, other.qualityGood, t)!,
      qualityFair: Color.lerp(qualityFair, other.qualityFair, t)!,
      qualityUsable: Color.lerp(qualityUsable, other.qualityUsable, t)!,
      qualityPoor: Color.lerp(qualityPoor, other.qualityPoor, t)!,
      qualityUnknown: Color.lerp(qualityUnknown, other.qualityUnknown, t)!,
    );
  }
}
