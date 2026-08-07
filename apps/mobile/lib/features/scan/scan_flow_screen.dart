import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapee_api/mapee_api.dart';

import '../../data/scan_outbox/scan_outbox.dart';
import '../../data/scan_outbox/scan_outbox_entry.dart';
import '../../design/motion/motion.dart';
import '../../design/tokens/colors.dart';
import '../../domain/entities/latency_sample.dart';
import '../../domain/entities/location_fix.dart';
import '../../domain/entities/throughput_result.dart';
import '../../services/network/isp_detector.dart';
import 'isp_step.dart';
import 'location_step.dart';
import 'result_step.dart';
import 'testing_step.dart';

enum _ScanStep { location, isp, testing, result }

Future<void> showScanFlow(BuildContext context) {
  return Navigator.of(context).push(
    CupertinoPageRoute(fullscreenDialog: true, builder: (context) => const ScanFlowScreen()),
  );
}

class ScanFlowScreen extends ConsumerStatefulWidget {
  const ScanFlowScreen({super.key});

  @override
  ConsumerState<ScanFlowScreen> createState() => _ScanFlowScreenState();
}

class _ScanFlowScreenState extends ConsumerState<ScanFlowScreen> {
  _ScanStep _step = _ScanStep.location;

  LocationFix? _locationFix;
  ISPName? _isp;
  LatencyResult? _latency;
  ThroughputResult? _download;
  ThroughputResult? _upload;
  bool _isPending = false;

  int get _stepIndex => _ScanStep.values.indexOf(_step);

  void _goBack() {
    if (_stepIndex == 0) return;
    setState(() => _step = _ScanStep.values[_stepIndex - 1]);
  }

  void _onLocationConfirmed(LocationFix fix) {
    setState(() {
      _locationFix = fix;
      _step = _ScanStep.isp;
    });
  }

  void _onIspConfirmed(ISPName isp) {
    setState(() {
      _isp = isp;
      _step = _ScanStep.testing;
    });
  }

  void _onTestingComplete({
    required LatencyResult latency,
    required ThroughputResult download,
    required ThroughputResult upload,
  }) {
    setState(() {
      _latency = latency;
      _download = download;
      _upload = upload;
      _step = _ScanStep.result;
    });
  }

  DeviceType _deviceType() {
    if (!Platform.isIOS && !Platform.isAndroid) return DeviceType.desktop;
    final shortestSide = MediaQuery.sizeOf(context).shortestSide;
    return shortestSide >= 600 ? DeviceType.tablet : DeviceType.mobile;
  }

  Future<void> _onSubmit() async {
    final fix = _locationFix;
    final isp = _isp;
    final latency = _latency;
    final download = _download;
    final upload = _upload;
    if (fix == null || isp == null || latency == null || download == null || upload == null) return;

    final deviceType = _deviceType();
    setState(() => _isPending = true);

    String? radioType;
    try {
      radioType = await ref.read(radioInfoServiceProvider).getRadioAccessTechnology();
    } catch (_) {
      radioType = null;
    }
    if (!mounted) return;

    // verifiedAsn/signalDbm/mcc/mnc have no real source wired up yet at this
    // integration point — left null rather than guessed, same "no fabricated
    // data" rule the measurement services themselves follow.
    final entry = ScanOutboxEntry.create(
      lat: fix.lat,
      lng: fix.lng,
      reportedIsp: isp,
      latencyMs: latency.averageMs,
      jitter: latency.jitterMs,
      uploadSpeed: upload.uploadMbps ?? 0,
      downloadSpeed: download.downloadMbps ?? 0,
      measurementMethod: CreateScanRequestMeasurementMethodEnum.measured,
      deviceType: deviceType,
      radioType: radioType,
    );

    await ref.read(scanOutboxProvider).enqueue(entry);
  }

  void _onDone() {
    Navigator.of(context).pop();
  }

  void _onCancel() {
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _onCancel,
          child: const Text('Cancel'),
        ),
        middle: _StepIndicator(current: _stepIndex, total: _ScanStep.values.length),
      ),
      child: Stack(
        children: [
          AnimatedSwitcher(
            duration: MapeeMotion.duration(context, const Duration(milliseconds: 250)),
            child: _buildStep(),
          ),
          if (_stepIndex > 0)
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 24,
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onHorizontalDragEnd: (details) {
                  if ((details.primaryVelocity ?? 0) > 200) _goBack();
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case _ScanStep.location:
        return LocationStep(
          key: const ValueKey('location'),
          onConfirmed: _onLocationConfirmed,
          onCancel: _onCancel,
        );
      case _ScanStep.isp:
        return IspStep(key: const ValueKey('isp'), onConfirmed: _onIspConfirmed);
      case _ScanStep.testing:
        return TestingStep(key: const ValueKey('testing'), onComplete: _onTestingComplete);
      case _ScanStep.result:
        return ResultStep(
          key: const ValueKey('result'),
          latency: _latency!,
          download: _download!,
          upload: _upload!,
          onSubmit: _onSubmit,
          onDone: _onDone,
          isPending: _isPending,
        );
    }
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.current, required this.total});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(total, (index) {
        final active = index == current;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 8 : 6,
          height: active ? 8 : 6,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? colors.accent : colors.separator,
          ),
        );
      }),
    );
  }
}
