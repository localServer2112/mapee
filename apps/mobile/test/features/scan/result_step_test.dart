import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/domain/entities/latency_sample.dart';
import 'package:mapee_mobile/domain/entities/throughput_result.dart';
import 'package:mapee_mobile/domain/latency.dart';
import 'package:mapee_mobile/features/scan/result_step.dart';

LatencyResult _goodLatency() => const LatencyResult(
      samples: [40, 42, 38],
      failedAttempts: 0,
      averageMs: 40,
      medianMs: 40,
      jitterMs: 3,
      status: LatencyStatus.good,
    );

ThroughputResult _successThroughput({required double download}) => ThroughputResult(
      outcome: ThroughputOutcome.success,
      downloadMbps: download,
      uploadMbps: download / 2,
      bytesTransferred: 1000000,
      elapsed: const Duration(seconds: 2),
    );

const _deniedThroughput = ThroughputResult(outcome: ThroughputOutcome.cellularConsentDenied);
const _errorThroughput = ThroughputResult(outcome: ThroughputOutcome.networkError);

Widget _wrap(Widget child) => CupertinoApp(home: Center(child: child));

void main() {
  testWidgets('renders real metric values for a fully successful result', (tester) async {
    await tester.pumpWidget(
      _wrap(
        ResultStep(
          latency: _goodLatency(),
          download: _successThroughput(download: 25.4),
          upload: _successThroughput(download: 12.0),
          onSubmit: () {},
          onDone: () {},
        ),
      ),
    );

    expect(find.text('40 ms'), findsOneWidget);
    expect(find.text('3 ms'), findsOneWidget);
    expect(find.text('25.4 Mbps'), findsOneWidget);
    expect(find.text('6.0 Mbps'), findsOneWidget);
  });

  testWidgets('renders an honest not-measured cell for cellular consent denial, no crash', (tester) async {
    await tester.pumpWidget(
      _wrap(
        ResultStep(
          latency: _goodLatency(),
          download: _deniedThroughput,
          upload: _deniedThroughput,
          onSubmit: () {},
          onDone: () {},
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Not measured'), findsNWidgets(2));
    expect(find.textContaining('Mbps'), findsNothing);
  });

  testWidgets("renders 'Couldn't measure' for a network error, distinct from consent denial", (tester) async {
    await tester.pumpWidget(
      _wrap(
        ResultStep(
          latency: _goodLatency(),
          download: _errorThroughput,
          upload: _errorThroughput,
          onSubmit: () {},
          onDone: () {},
        ),
      ),
    );

    expect(find.text("Couldn't measure"), findsNWidgets(2));
  });

  testWidgets('tapping Submit calls onSubmit exactly once', (tester) async {
    var submitCount = 0;
    await tester.pumpWidget(
      _wrap(
        ResultStep(
          latency: _goodLatency(),
          download: _successThroughput(download: 25.4),
          upload: _successThroughput(download: 12.0),
          onSubmit: () => submitCount++,
          onDone: () {},
        ),
      ),
    );

    await tester.tap(find.text('Submit'));
    await tester.pump();

    expect(submitCount, 1);
  });

  testWidgets('isPending shows a syncing state and Submit is no longer tappable', (tester) async {
    var submitCount = 0;
    await tester.pumpWidget(
      _wrap(
        ResultStep(
          latency: _goodLatency(),
          download: _successThroughput(download: 25.4),
          upload: _successThroughput(download: 12.0),
          onSubmit: () => submitCount++,
          onDone: () {},
          isPending: true,
        ),
      ),
    );

    expect(find.text('Submitted — syncing…'), findsOneWidget);
    expect(find.text('Submit'), findsNothing);

    await tester.tap(find.text('Submitted — syncing…'), warnIfMissed: false);
    await tester.pump();

    expect(submitCount, 0);
  });

  testWidgets('tapping Done calls onDone', (tester) async {
    var doneCalled = false;
    await tester.pumpWidget(
      _wrap(
        ResultStep(
          latency: _goodLatency(),
          download: _successThroughput(download: 25.4),
          upload: _successThroughput(download: 12.0),
          onSubmit: () {},
          onDone: () => doneCalled = true,
        ),
      ),
    );

    await tester.tap(find.text('Done'));
    await tester.pump();

    expect(doneCalled, isTrue);
  });

  testWidgets('interpretation text does not claim a throughput benefit when download is unavailable', (tester) async {
    await tester.pumpWidget(
      _wrap(
        ResultStep(
          latency: _goodLatency(),
          download: _successThroughput(download: 25.4),
          upload: _successThroughput(download: 12.0),
          onSubmit: () {},
          onDone: () {},
        ),
      ),
    );
    final withThroughput = tester
        .widget<Text>(find.byKey(const ValueKey('resultStepInterpretation')))
        .data;

    await tester.pumpWidget(
      _wrap(
        ResultStep(
          latency: _goodLatency(),
          download: _deniedThroughput,
          upload: _deniedThroughput,
          onSubmit: () {},
          onDone: () {},
        ),
      ),
    );
    final withoutThroughput = tester
        .widget<Text>(find.byKey(const ValueKey('resultStepInterpretation')))
        .data;

    expect(withThroughput, isNot(equals(withoutThroughput)));
    expect(withThroughput, contains('streaming'));
    expect(withoutThroughput, isNot(contains('streaming')));
    expect(withoutThroughput, contains("couldn't confirm"));
  });
}
