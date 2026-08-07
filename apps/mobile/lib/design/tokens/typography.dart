import 'package:flutter/cupertino.dart';

/// Text style ramp (plan §4.2). No monospace UI, no uppercase labels —
/// SF Pro / Roboto via platform defaults. `metricValue` is the one
/// exception: tabular figures so digits don't jitter during a live test,
/// via a font feature rather than switching to a mono family.
class MapeeTypography {
  const MapeeTypography._();

  static const largeTitle = TextStyle(fontSize: 34, fontWeight: FontWeight.bold, height: 1.2);
  static const title2 = TextStyle(fontSize: 22, fontWeight: FontWeight.bold, height: 1.25);
  static const headline = TextStyle(fontSize: 17, fontWeight: FontWeight.w600, height: 1.3);
  static const body = TextStyle(fontSize: 17, fontWeight: FontWeight.normal, height: 1.35);
  static const subheadline = TextStyle(fontSize: 15, fontWeight: FontWeight.normal, height: 1.35);
  static const footnote = TextStyle(fontSize: 13, fontWeight: FontWeight.normal, height: 1.35);
  static const caption1 = TextStyle(fontSize: 12, fontWeight: FontWeight.normal, height: 1.3);

  static const metricValue = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.bold,
    height: 1.2,
    fontFeatures: [FontFeature.tabularFigures()],
  );
}
