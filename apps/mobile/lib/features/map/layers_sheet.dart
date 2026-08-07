import 'package:flutter/cupertino.dart';

import '../../design/primitives/mapee_row.dart';
import '../../design/primitives/mapee_sheet.dart';
import '../../design/tokens/typography.dart';

/// Replaces the legacy web app's two unlabelled icon-only map toggles with a
/// labelled sheet (plan §3), so each control is self-describing per HIG.
Future<void> showLayersSheet(
  BuildContext context, {
  required bool showTowers,
  required bool showHeatmap,
  required ValueChanged<bool> onTowersChanged,
  required ValueChanged<bool> onHeatmapChanged,
}) {
  return MapeeSheet.show(
    context: context,
    builder: (sheetContext) {
      return StatefulBuilder(
        builder: (context, setState) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Map Layers', style: MapeeTypography.title2),
              const SizedBox(height: 8),
              MapeeRow(
                title: 'Cell towers',
                subtitle: 'Nearby 4G/5G tower locations',
                showChevron: false,
                trailing: CupertinoSwitch(
                  value: showTowers,
                  onChanged: (value) {
                    setState(() => showTowers = value);
                    onTowersChanged(value);
                  },
                ),
              ),
              MapeeRow(
                title: 'Heatmap',
                subtitle: 'Network quality density overlay',
                showChevron: false,
                trailing: CupertinoSwitch(
                  value: showHeatmap,
                  onChanged: (value) {
                    setState(() => showHeatmap = value);
                    onHeatmapChanged(value);
                  },
                ),
              ),
            ],
          );
        },
      );
    },
  );
}
