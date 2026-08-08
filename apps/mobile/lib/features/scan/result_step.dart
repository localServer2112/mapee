import 'package:flutter/cupertino.dart';
import 'package:share_plus/share_plus.dart';

import '../../design/primitives/mapee_button.dart';
import '../../design/primitives/mapee_metric_cell.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import '../../domain/entities/latency_sample.dart';
import '../../domain/entities/throughput_result.dart';
import '../../domain/latency.dart';

class ResultStep extends StatelessWidget {
  const ResultStep({
    super.key,
    required this.latency,
    required this.download,
    required this.upload,
    required this.onSubmit,
    required this.onDone,
    this.isPending = false,
  });

  final LatencyResult latency;
  final ThroughputResult download;
  final ThroughputResult upload;
  final VoidCallback onSubmit;
  final VoidCallback onDone;
  final bool isPending;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    final downloadOk = download.isSuccess && download.downloadMbps != null;
    final interpretation = _interpretation(latency.status, downloadOk);
    final downloadValue = _throughputValue(download, download.downloadMbps);
    final uploadValue = _throughputValue(upload, upload.uploadMbps);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Result', style: MapeeTypography.title2.copyWith(color: colors.label)),
        const SizedBox(height: MapeeSpacing.lg),
        Row(
          children: [
            Expanded(child: MapeeMetricCell(value: '${latency.averageMs} ms', label: 'Latency')),
            Expanded(child: MapeeMetricCell(value: '${latency.jitterMs} ms', label: 'Jitter')),
            Expanded(child: MapeeMetricCell(value: downloadValue, label: 'Download')),
            Expanded(child: MapeeMetricCell(value: uploadValue, label: 'Upload')),
          ],
        ),
        const SizedBox(height: MapeeSpacing.lg),
        Text(
          interpretation,
          key: const ValueKey('resultStepInterpretation'),
          style: MapeeTypography.body.copyWith(color: colors.secondaryLabel),
        ),
        const SizedBox(height: MapeeSpacing.lg),
        MapeeButton(
          label: isPending ? 'Submitted — syncing…' : 'Submit',
          icon: isPending ? CupertinoIcons.cloud_upload : null,
          onPressed: isPending ? null : onSubmit,
        ),
        const SizedBox(height: MapeeSpacing.sm),
        Row(
          children: [
            Expanded(
              child: MapeeButton(
                label: 'Share',
                variant: MapeeButtonVariant.secondary,
                onPressed: () => _share(
                  interpretation: interpretation,
                  latency: latency,
                  downloadValue: downloadValue,
                  uploadValue: uploadValue,
                ),
              ),
            ),
            const SizedBox(width: MapeeSpacing.sm),
            Expanded(
              child: MapeeButton(
                label: 'Done',
                variant: MapeeButtonVariant.secondary,
                onPressed: onDone,
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _share({
    required String interpretation,
    required LatencyResult latency,
    required String downloadValue,
    required String uploadValue,
  }) {
    final text = [
      'Mapee network test result',
      'Latency: ${latency.averageMs} ms (jitter ${latency.jitterMs} ms)',
      'Download: $downloadValue',
      'Upload: $uploadValue',
      '',
      interpretation,
    ].join('\n');
    SharePlus.instance.share(ShareParams(text: text));
  }
}

String _throughputValue(ThroughputResult result, double? mbps) {
  if (mbps != null) return '${mbps.toStringAsFixed(1)} Mbps';
  switch (result.outcome) {
    case ThroughputOutcome.cellularConsentDenied:
      return 'Not measured';
    case ThroughputOutcome.networkError:
    case ThroughputOutcome.timeout:
      return "Couldn't measure";
    case ThroughputOutcome.budgetExceeded:
      return 'Skipped';
    case ThroughputOutcome.success:
      return '—';
  }
}

String _interpretation(LatencyStatus status, bool downloadOk) {
  switch (status) {
    case LatencyStatus.poor:
      return 'Latency is high, so calls and video may lag or drop.';
    case LatencyStatus.good:
      return downloadOk
          ? 'Good for video calls and streaming — latency and download speed both look solid.'
          : "Latency looks great, though we couldn't confirm your download speed this time.";
    case LatencyStatus.fair:
      return downloadOk
          ? 'Fine for browsing and standard streaming; video calls may occasionally lag.'
          : "Latency is average — fine for browsing, though we couldn't confirm your download speed.";
  }
}
