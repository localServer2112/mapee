import 'package:flutter/cupertino.dart';

import '../../data/api/api_client.dart';
import '../../data/repositories/config_repository.dart';
import '../../design/haptics/haptics.dart';
import '../../design/motion/motion.dart';
import '../../design/primitives/mapee_button.dart';
import '../../design/primitives/mapee_metric_cell.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import '../../domain/entities/latency_sample.dart';
import '../../domain/entities/throughput_result.dart';
import '../../services/measurement/tcp_latency_service.dart';
import '../../services/measurement/throughput_service.dart';

typedef TestingStepCallback = void Function({
  required LatencyResult latency,
  required ThroughputResult download,
  required ThroughputResult upload,
});

class TestingStep extends StatefulWidget {
  TestingStep({
    super.key,
    required this.onComplete,
    TcpLatencyService? latencyService,
    ThroughputService? throughputService,
  })  : latencyService = latencyService ?? TcpLatencyService(),
        throughputService =
            throughputService ?? ThroughputService(ConfigRepository(ApiClient()));

  final TestingStepCallback onComplete;
  final TcpLatencyService latencyService;
  final ThroughputService throughputService;

  @override
  State<TestingStep> createState() => _TestingStepState();
}

class _TestingStepState extends State<TestingStep> {
  static const _estimatedTotalBytes =
      ThroughputService.defaultDownloadBudgetBytes + ThroughputService.defaultUploadBudgetBytes;

  LatencyResult? _latencyResult;
  ThroughputResult? _downloadResult;
  ThroughputResult? _uploadResult;
  ThroughputResult? _cellularDeniedResult;
  bool _showCellularConfirm = false;

  int get _estimatedMb => (_estimatedTotalBytes / (1024 * 1024)).round();

  @override
  void initState() {
    super.initState();
    _runFlow();
  }

  Future<void> _runFlow() async {
    final latency = await widget.latencyService.measure();
    if (!mounted) return;
    setState(() => _latencyResult = latency);

    final download = await widget.throughputService.measureDownload(allowCellular: false);
    if (!mounted) return;

    if (download.outcome == ThroughputOutcome.cellularConsentDenied) {
      setState(() {
        _cellularDeniedResult = download;
        _showCellularConfirm = true;
      });
      return;
    }

    setState(() => _downloadResult = download);
    // The device was never blocked on cellular for the download, so it's
    // either on Wi-Fi or cellular consent isn't a concern here either —
    // `allowCellular: false` is then a no-op restriction, not a real block.
    await _runUpload(allowCellular: false);
  }

  Future<void> _onContinueCellular() async {
    MapeeHaptics.selectionClick();
    setState(() => _showCellularConfirm = false);
    final download = await widget.throughputService.measureDownload(allowCellular: true);
    if (!mounted) return;
    setState(() => _downloadResult = download);
    // Only force allowCellular on the upload because the user just agreed to
    // it for the download — this is the one place that consent carries
    // forward instead of asking a second time.
    await _runUpload(allowCellular: true);
  }

  void _onSkipCellular() {
    MapeeHaptics.selectionClick();
    final denied = _cellularDeniedResult!;
    setState(() {
      _showCellularConfirm = false;
      _downloadResult = denied;
      _uploadResult = denied;
    });
    _finish();
  }

  Future<void> _runUpload({required bool allowCellular}) async {
    final upload = await widget.throughputService.measureUpload(allowCellular: allowCellular);
    if (!mounted) return;
    setState(() => _uploadResult = upload);
    _finish();
  }

  void _finish() {
    final latency = _latencyResult;
    final download = _downloadResult;
    final upload = _uploadResult;
    if (latency == null || download == null || upload == null) return;
    MapeeHaptics.success();
    widget.onComplete(latency: latency, download: download, upload: upload);
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(MapeeSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Testing Your Connection', style: MapeeTypography.title2.copyWith(color: colors.label)),
            const SizedBox(height: MapeeSpacing.sm),
            Text(
              'Estimated data use: ~$_estimatedMb MB',
              style: MapeeTypography.footnote.copyWith(color: colors.secondaryLabel),
            ),
            const SizedBox(height: MapeeSpacing.lg),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildLatencySection(colors),
                    const SizedBox(height: MapeeSpacing.md),
                    _buildDownloadSection(colors),
                    const SizedBox(height: MapeeSpacing.md),
                    _buildUploadSection(colors),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLatencySection(MapeeColors colors) {
    final result = _latencyResult;
    if (result == null) {
      return _PhaseCard(
        colors: colors,
        title: 'Latency',
        child: const _ActivePhase(label: 'Testing latency…'),
      );
    }
    if (!result.hasData) {
      return _PhaseCard(
        colors: colors,
        title: 'Latency',
        child: _FailureCaption(colors: colors, message: "Couldn't reach the test server."),
      );
    }
    return _PhaseCard(
      colors: colors,
      title: 'Latency',
      child: Row(
        children: [
          Expanded(child: MapeeMetricCell(value: '${result.averageMs} ms', label: 'Avg latency')),
          Expanded(child: MapeeMetricCell(value: '${result.jitterMs} ms', label: 'Jitter')),
        ],
      ),
    );
  }

  Widget _buildDownloadSection(MapeeColors colors) {
    if (_showCellularConfirm) {
      return _CellularConsentCard(
        colors: colors,
        estimatedMb: _estimatedMb,
        onContinue: _onContinueCellular,
        onSkip: _onSkipCellular,
      );
    }

    final result = _downloadResult;
    if (result == null) {
      return _PhaseCard(
        colors: colors,
        title: 'Download',
        child: _latencyResult == null
            ? _PendingPhase(colors: colors, label: 'Waiting…')
            : const _ActivePhase(label: 'Testing download speed…'),
      );
    }
    if (!result.isSuccess) {
      return _PhaseCard(
        colors: colors,
        title: 'Download',
        child: _FailureCaption(colors: colors, message: _throughputFailureMessage(result.outcome)),
      );
    }
    return _PhaseCard(
      colors: colors,
      title: 'Download',
      child: MapeeMetricCell(value: '${result.downloadMbps!.toStringAsFixed(1)} Mbps', label: 'Download speed'),
    );
  }

  Widget _buildUploadSection(MapeeColors colors) {
    final result = _uploadResult;
    if (result == null) {
      return _PhaseCard(
        colors: colors,
        title: 'Upload',
        child: _downloadResult == null || _showCellularConfirm
            ? _PendingPhase(colors: colors, label: 'Waiting…')
            : const _ActivePhase(label: 'Testing upload speed…'),
      );
    }
    if (!result.isSuccess) {
      return _PhaseCard(
        colors: colors,
        title: 'Upload',
        child: _FailureCaption(colors: colors, message: _throughputFailureMessage(result.outcome)),
      );
    }
    return _PhaseCard(
      colors: colors,
      title: 'Upload',
      child: MapeeMetricCell(value: '${result.uploadMbps!.toStringAsFixed(1)} Mbps', label: 'Upload speed'),
    );
  }

  String _throughputFailureMessage(ThroughputOutcome outcome) {
    switch (outcome) {
      case ThroughputOutcome.cellularConsentDenied:
        return "Skipped — you declined to use cellular data.";
      case ThroughputOutcome.timeout:
        return 'Test timed out.';
      case ThroughputOutcome.networkError:
        return "Couldn't reach the test server.";
      case ThroughputOutcome.budgetExceeded:
        return 'Data budget reached before a measurement completed.';
      case ThroughputOutcome.success:
        return '';
    }
  }
}

class _PhaseCard extends StatelessWidget {
  const _PhaseCard({required this.colors, required this.title, required this.child});

  final MapeeColors colors;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: MapeeMotion.duration(context, const Duration(milliseconds: 250)),
      padding: const EdgeInsets.all(MapeeSpacing.md),
      decoration: BoxDecoration(
        color: colors.secondaryBackground,
        borderRadius: BorderRadius.circular(MapeeSpacing.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: MapeeTypography.subheadline.copyWith(color: colors.secondaryLabel)),
          const SizedBox(height: MapeeSpacing.sm),
          AnimatedSwitcher(
            duration: MapeeMotion.duration(context, const Duration(milliseconds: 250)),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _ActivePhase extends StatelessWidget {
  const _ActivePhase({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Row(
      key: ValueKey(label),
      children: [
        const CupertinoActivityIndicator(radius: 10),
        const SizedBox(width: MapeeSpacing.sm),
        Text(label, style: MapeeTypography.body.copyWith(color: colors.label)),
      ],
    );
  }
}

class _PendingPhase extends StatelessWidget {
  const _PendingPhase({required this.colors, required this.label});

  final MapeeColors colors;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      key: ValueKey('pending-$label'),
      label,
      style: MapeeTypography.body.copyWith(color: colors.tertiaryLabel),
    );
  }
}

class _FailureCaption extends StatelessWidget {
  const _FailureCaption({required this.colors, required this.message});

  final MapeeColors colors;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Text(
      key: ValueKey('failure-$message'),
      message,
      style: MapeeTypography.body.copyWith(color: colors.secondaryLabel),
    );
  }
}

class _CellularConsentCard extends StatelessWidget {
  const _CellularConsentCard({
    required this.colors,
    required this.estimatedMb,
    required this.onContinue,
    required this.onSkip,
  });

  final MapeeColors colors;
  final int estimatedMb;
  final VoidCallback onContinue;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(MapeeSpacing.md),
      decoration: BoxDecoration(
        color: colors.secondaryBackground,
        borderRadius: BorderRadius.circular(MapeeSpacing.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            "You're on a cellular connection. Running this test may use your "
            'data plan (~$estimatedMb MB). Continue?',
            style: MapeeTypography.body.copyWith(color: colors.label),
          ),
          const SizedBox(height: MapeeSpacing.md),
          MapeeButton(label: 'Continue', onPressed: onContinue),
          const SizedBox(height: MapeeSpacing.sm),
          MapeeButton(label: 'Skip', variant: MapeeButtonVariant.secondary, onPressed: onSkip),
        ],
      ),
    );
  }
}
