import 'package:flutter/cupertino.dart';

import '../../design/primitives/mapee_chip.dart';
import '../../design/primitives/mapee_metric_cell.dart';
import '../../design/primitives/mapee_sheet.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/typography.dart';
import '../../domain/entities/area_stats.dart';

/// Area detail sheet (plan §3 screen map). Medium detent only for this
/// vertical slice — the large-detent expansion and the real methodology
/// copy are Phase 1/5 work.
Future<void> showAreaSheet(BuildContext context, AreaStats area) {
  return MapeeSheet.show(
    context: context,
    builder: (context) => _AreaSheetContent(area: area),
  );
}

class _AreaSheetContent extends StatelessWidget {
  const _AreaSheetContent({required this.area});

  final AreaStats area;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    final quality = _qualityPresentation(area.quality);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(area.topIsp, style: MapeeTypography.title2.copyWith(color: colors.label)),
            ),
            MapeeChip(label: quality.label, icon: quality.icon, color: quality.color),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '${area.pingCount} scans · ${area.confidenceScore}% confidence',
          style: MapeeTypography.subheadline.copyWith(color: colors.secondaryLabel),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: MapeeMetricCell(value: '${area.avgLatencyMs} ms', label: 'Avg latency'),
            ),
            Expanded(
              child: MapeeMetricCell(value: '${area.minLatencyMs} ms', label: 'Min'),
            ),
            Expanded(
              child: MapeeMetricCell(value: '${area.maxLatencyMs} ms', label: 'Max'),
            ),
          ],
        ),
      ],
    );
  }

  _QualityPresentation _qualityPresentation(AreaQuality quality) {
    final colors = MapeeColors.light;
    return switch (quality) {
      AreaQuality.excellent => _QualityPresentation(
          'Excellent',
          CupertinoIcons.checkmark_circle_fill,
          colors.qualityExcellent,
        ),
      AreaQuality.good => _QualityPresentation(
          'Good',
          CupertinoIcons.arrow_up_circle_fill,
          colors.qualityGood,
        ),
      AreaQuality.fair => _QualityPresentation(
          'Fair',
          CupertinoIcons.minus_circle_fill,
          colors.qualityFair,
        ),
      AreaQuality.usable => _QualityPresentation(
          'Usable',
          CupertinoIcons.exclamationmark_circle_fill,
          colors.qualityUsable,
        ),
      AreaQuality.poor => _QualityPresentation(
          'Poor',
          CupertinoIcons.xmark_circle_fill,
          colors.qualityPoor,
        ),
      AreaQuality.unknown => _QualityPresentation(
          'Unknown',
          CupertinoIcons.question_circle_fill,
          colors.qualityUnknown,
        ),
    };
  }
}

class _QualityPresentation {
  const _QualityPresentation(this.label, this.icon, this.color);

  final String label;
  final IconData icon;
  final Color color;
}
