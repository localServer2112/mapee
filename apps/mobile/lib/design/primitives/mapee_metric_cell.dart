import 'package:flutter/cupertino.dart';

import '../tokens/colors.dart';
import '../tokens/spacing.dart';
import '../tokens/typography.dart';

/// A single metric readout: a tabular-figure value plus a caption label
/// (e.g. "142 ms" / "Avg latency"). Extracted from the ad-hoc `_Metric`
/// pattern in the area sheet into a reusable primitive for any metric grid.
class MapeeMetricCell extends StatelessWidget {
  const MapeeMetricCell({
    super.key,
    required this.value,
    required this.label,
    this.crossAxisAlignment = CrossAxisAlignment.start,
  });

  final String value;
  final String label;
  final CrossAxisAlignment crossAxisAlignment;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Column(
      crossAxisAlignment: crossAxisAlignment,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(value, style: MapeeTypography.metricValue.copyWith(color: colors.label)),
        const SizedBox(height: MapeeSpacing.xs),
        Text(label, style: MapeeTypography.caption1.copyWith(color: colors.secondaryLabel)),
      ],
    );
  }
}
