import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/config_repository.dart';
import 'package:mapee_mobile/domain/entities/latency_sample.dart';
import 'package:mapee_mobile/domain/entities/throughput_result.dart';
import 'package:mapee_mobile/domain/latency.dart';
import 'package:mapee_mobile/features/scan/testing_step.dart';
import 'package:mapee_mobile/services/measurement/tcp_latency_service.dart';
import 'package:mapee_mobile/services/measurement/throughput_service.dart';

class _LoopbackLatencyService extends TcpLatencyService {
  _LoopbackLatencyService({required this.host, required this.port});

  final String host;
  final int port;

  @override
  Future<LatencyResult> measure({
    String host = TcpLatencyService.defaultHost,
    int port = TcpLatencyService.defaultPort,
    int sampleCount = 5,
    Duration timeout = const Duration(seconds: 3),
  }) {
    return super.measure(
      host: this.host,
      port: this.port,
      sampleCount: sampleCount,
      timeout: timeout,
    );
  }
}

// Connecting to a closed loopback port never gets refused inside a
// testWidgets test in this environment either — confirmed by running that
// scenario in isolation, where it hangs past any real-world OS refusal time
// with zero CPU movement. TcpLatencyService's own refused-connection handling
// is already covered for real by tcp_latency_service_test.dart's plain
// test()s against a real loopback server; this fake lets TestingStep's own
// honest-failure UI/callback behavior be tested without touching a socket.
class _FailedLatencyService extends TcpLatencyService {
  @override
  Future<LatencyResult> measure({
    String host = TcpLatencyService.defaultHost,
    int port = TcpLatencyService.defaultPort,
    int sampleCount = 5,
    Duration timeout = const Duration(seconds: 3),
  }) async {
    return LatencyResult(
      samples: const [],
      failedAttempts: sampleCount,
      averageMs: 0,
      medianMs: 0,
      jitterMs: 0,
      status: LatencyStatus.poor,
    );
  }
}

// A real dart:io HttpClient request never completes inside a testWidgets
// test in this environment — confirmed even for a bare HttpClient.getUrl()
// with HttpOverrides genuinely disabled, so this isn't fixable by giving Dio
// a "real" client. Only raw Socket I/O (used by TcpLatencyService above)
// actually completes here. ThroughputService's real-transfer correctness is
// already covered by throughput_service_test.dart's plain test()s against a
// real loopback server; this fake mirrors its observable cellular-consent
// contract without touching Dio/HTTP, so this file can test TestingStep's
// own orchestration logic (phase sequencing, consent branching) for real.
//
// Deliberately no timer- or microtask-count-based delay to simulate "still
// transferring": any Future.delayed created here runs inside the widget's
// own initState-triggered async chain, bound to
// AutomatedTestWidgetsFlutterBinding's fake-timer zone, which this file's
// _pump helper never advances (it advances real time instead, for the real
// Socket-based latency phase) — and a fixed microtask-hop count just races
// tester.pump()'s own microtask draining unpredictably. A Completer the test
// resolves explicitly sidesteps timing entirely.
class _FakeThroughputService extends ThroughputService {
  _FakeThroughputService(this._checker) : super(ConfigRepository(ApiClient()), checkConnectivity: _checker);

  final Future<List<ConnectivityResult>> Function() _checker;
  final List<bool> downloadAllowCellularCalls = [];
  final List<bool> uploadAllowCellularCalls = [];
  Completer<ThroughputResult>? pendingDownload;
  Completer<ThroughputResult>? pendingUpload;

  @override
  Future<ThroughputResult> measureDownload({
    int maxBytes = ThroughputService.defaultDownloadBudgetBytes,
    Duration timeout = ThroughputService.defaultTimeout,
    bool allowCellular = false,
  }) async {
    downloadAllowCellularCalls.add(allowCellular);
    if (!allowCellular && (await _checker()).contains(ConnectivityResult.mobile)) {
      return const ThroughputResult(outcome: ThroughputOutcome.cellularConsentDenied);
    }
    final completer = Completer<ThroughputResult>();
    pendingDownload = completer;
    return completer.future;
  }

  @override
  Future<ThroughputResult> measureUpload({
    int bytesToSend = ThroughputService.defaultUploadBudgetBytes,
    Duration timeout = ThroughputService.defaultTimeout,
    bool allowCellular = false,
  }) async {
    uploadAllowCellularCalls.add(allowCellular);
    if (!allowCellular && (await _checker()).contains(ConnectivityResult.mobile)) {
      return const ThroughputResult(outcome: ThroughputOutcome.cellularConsentDenied);
    }
    final completer = Completer<ThroughputResult>();
    pendingUpload = completer;
    return completer.future;
  }
}

const _downloadSuccess = ThroughputResult(
  outcome: ThroughputOutcome.success,
  downloadMbps: 42.0,
  bytesTransferred: 8 * 1024 * 1024,
  elapsed: Duration(milliseconds: 200),
);

const _uploadSuccess = ThroughputResult(
  outcome: ThroughputOutcome.success,
  uploadMbps: 12.0,
  bytesTransferred: 2 * 1024 * 1024,
  elapsed: Duration(milliseconds: 100),
);

Future<List<ConnectivityResult>> _wifi() async => [ConnectivityResult.wifi];
Future<List<ConnectivityResult>> _cellular() async => [ConnectivityResult.mobile];

// tester.pump(duration) only advances the fake clock AutomatedTestWidgetsFlutterBinding
// uses for Timers — it never gives the real event loop wall-clock time to
// run, so the real Socket I/O the latency phase performs never progresses.
// runAsync() escapes that fake zone for a real delay each iteration, then a
// zero-duration pump() flushes the resulting state into the widget tree.
Future<void> _pump(WidgetTester tester, {int frames = 20}) async {
  for (var i = 0; i < frames; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump();
  }
}

void main() {
  late ServerSocket latencyServer;

  setUp(() async {
    latencyServer = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    latencyServer.listen((socket) => socket.destroy());
  });

  tearDown(() async {
    await latencyServer.close();
  });

  Widget wrap(Widget child) => CupertinoApp(home: child);

  testWidgets(
    'happy path on wifi: readouts appear progressively and onComplete gets real data',
    (tester) async {
      LatencyResult? completedLatency;
      ThroughputResult? completedDownload;
      ThroughputResult? completedUpload;
      final fakeThroughput = _FakeThroughputService(_wifi);

      await tester.pumpWidget(
        wrap(
          TestingStep(
            latencyService: _LoopbackLatencyService(
              host: latencyServer.address.address,
              port: latencyServer.port,
            ),
            throughputService: fakeThroughput,
            onComplete: ({required latency, required download, required upload}) {
              completedLatency = latency;
              completedDownload = download;
              completedUpload = upload;
            },
          ),
        ),
      );

      expect(find.text('Testing latency…'), findsOneWidget);
      expect(completedLatency, isNull);

      await _pump(tester, frames: 25);
      expect(find.text('Testing download speed…'), findsOneWidget);
      expect(find.textContaining('Avg latency'), findsOneWidget);
      expect(find.textContaining('Mbps'), findsNothing);
      expect(fakeThroughput.pendingDownload, isNotNull);

      fakeThroughput.pendingDownload!.complete(_downloadSuccess);
      await _pump(tester, frames: 3);
      expect(find.text('Testing upload speed…'), findsOneWidget);
      expect(fakeThroughput.pendingUpload, isNotNull);

      fakeThroughput.pendingUpload!.complete(_uploadSuccess);
      await _pump(tester, frames: 3);

      expect(completedLatency, isNotNull);
      expect(completedLatency!.hasData, isTrue);
      expect(completedDownload, isNotNull);
      expect(completedDownload!.isSuccess, isTrue);
      expect(completedUpload, isNotNull);
      expect(completedUpload!.isSuccess, isTrue);
      expect(find.textContaining('Download speed'), findsOneWidget);
      expect(find.textContaining('Upload speed'), findsOneWidget);
    },
  );

  testWidgets(
    'cellular consent denied: Skip declines both download and upload without transferring bytes',
    (tester) async {
      ThroughputResult? completedDownload;
      ThroughputResult? completedUpload;
      final fakeThroughput = _FakeThroughputService(_cellular);

      await tester.pumpWidget(
        wrap(
          TestingStep(
            latencyService: _LoopbackLatencyService(
              host: latencyServer.address.address,
              port: latencyServer.port,
            ),
            throughputService: fakeThroughput,
            onComplete: ({required latency, required download, required upload}) {
              completedDownload = download;
              completedUpload = upload;
            },
          ),
        ),
      );

      await _pump(tester, frames: 15);

      expect(
        find.textContaining("You're on a cellular connection"),
        findsOneWidget,
      );

      await tester.tap(find.text('Skip'));
      await _pump(tester, frames: 3);

      expect(completedDownload, isNotNull);
      expect(completedDownload!.outcome, ThroughputOutcome.cellularConsentDenied);
      expect(completedUpload, isNotNull);
      expect(completedUpload!.outcome, ThroughputOutcome.cellularConsentDenied);
      expect(fakeThroughput.downloadAllowCellularCalls, [false]);
      expect(fakeThroughput.uploadAllowCellularCalls, isEmpty);
    },
  );

  testWidgets(
    'cellular consent Continue proceeds with allowCellular true for both phases',
    (tester) async {
      ThroughputResult? completedDownload;
      ThroughputResult? completedUpload;
      final fakeThroughput = _FakeThroughputService(_cellular);

      await tester.pumpWidget(
        wrap(
          TestingStep(
            latencyService: _LoopbackLatencyService(
              host: latencyServer.address.address,
              port: latencyServer.port,
            ),
            throughputService: fakeThroughput,
            onComplete: ({required latency, required download, required upload}) {
              completedDownload = download;
              completedUpload = upload;
            },
          ),
        ),
      );

      await _pump(tester, frames: 15);
      expect(find.textContaining("You're on a cellular connection"), findsOneWidget);

      await tester.tap(find.text('Continue'));
      await _pump(tester, frames: 3);
      expect(fakeThroughput.pendingDownload, isNotNull);

      fakeThroughput.pendingDownload!.complete(_downloadSuccess);
      await _pump(tester, frames: 3);
      expect(fakeThroughput.pendingUpload, isNotNull);

      fakeThroughput.pendingUpload!.complete(_uploadSuccess);
      await _pump(tester, frames: 3);

      expect(completedDownload, isNotNull);
      expect(completedDownload!.isSuccess, isTrue);
      expect(completedUpload, isNotNull);
      expect(completedUpload!.isSuccess, isTrue);
      expect(fakeThroughput.downloadAllowCellularCalls, [false, true]);
      expect(fakeThroughput.uploadAllowCellularCalls, [true]);
    },
  );

  testWidgets(
    'unreachable latency host still completes the flow honestly',
    (tester) async {
      LatencyResult? completedLatency;
      final fakeThroughput = _FakeThroughputService(_wifi);

      await tester.pumpWidget(
        wrap(
          TestingStep(
            latencyService: _FailedLatencyService(),
            throughputService: fakeThroughput,
            onComplete: ({required latency, required download, required upload}) {
              completedLatency = latency;
            },
          ),
        ),
      );

      await _pump(tester, frames: 3);

      expect(completedLatency, isNull);
      expect(find.text("Couldn't reach the test server."), findsOneWidget);

      fakeThroughput.pendingDownload!.complete(_downloadSuccess);
      await _pump(tester, frames: 3);
      fakeThroughput.pendingUpload!.complete(_uploadSuccess);
      await _pump(tester, frames: 3);

      expect(completedLatency, isNotNull);
      expect(completedLatency!.hasData, isFalse);
    },
  );
}
