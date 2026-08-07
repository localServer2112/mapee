import 'package:flutter/cupertino.dart';
import 'package:share_plus/share_plus.dart';

import '../../design/primitives/mapee_button.dart';
import '../../design/primitives/mapee_metric_cell.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import '../../domain/entities/my_scan.dart';
import 'scan_format.dart';

class ScanDetailScreen extends StatelessWidget {
  const ScanDetailScreen({super.key, required this.scan});

  final MyScan scan;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    final downloadValue = scan.isMeasured ? '${scan.downloadMbps.toStringAsFixed(1)} Mbps' : 'Not measured';
    final uploadValue = scan.isMeasured ? '${scan.uploadMbps.toStringAsFixed(1)} Mbps' : 'Not measured';
    final methodLabel = scan.isMeasured ? 'Measured' : 'Heuristic ping';

    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('Scan Detail')),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(MapeeSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(scan.ispDisplayName, style: MapeeTypography.title2.copyWith(color: colors.label)),
              const SizedBox(height: MapeeSpacing.xs),
              Text(
                formatScanTimestamp(scan.timestamp),
                style: MapeeTypography.subheadline.copyWith(color: colors.secondaryLabel),
              ),
              const SizedBox(height: MapeeSpacing.lg),
              Row(
                children: [
                  Expanded(child: MapeeMetricCell(value: '${scan.latencyMs} ms', label: 'Latency')),
                  Expanded(child: MapeeMetricCell(value: '${scan.jitterMs} ms', label: 'Jitter')),
                  Expanded(child: MapeeMetricCell(value: downloadValue, label: 'Download')),
                  Expanded(child: MapeeMetricCell(value: uploadValue, label: 'Upload')),
                ],
              ),
              const SizedBox(height: MapeeSpacing.lg),
              Text(
                '$methodLabel on ${scan.deviceType}',
                style: MapeeTypography.footnote.copyWith(color: colors.secondaryLabel),
              ),
              const Spacer(),
              MapeeButton(
                label: 'Share',
                icon: CupertinoIcons.share,
                variant: MapeeButtonVariant.secondary,
                onPressed: () => SharePlus.instance.share(ShareParams(text: composeScanShareText(scan))),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
