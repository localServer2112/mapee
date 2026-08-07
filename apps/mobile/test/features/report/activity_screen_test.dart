import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_skeleton.dart';
import 'package:mapee_mobile/domain/entities/my_scan.dart';
import 'package:mapee_mobile/features/report/activity_screen.dart';

const _measuredScan = MyScan(
  id: 'scan-1',
  lat: 6.5244,
  lng: 3.3792,
  ispDisplayName: 'MTN Nigeria',
  verifiedAsn: 'AS29465',
  latencyMs: 62,
  jitterMs: 5,
  uploadMbps: 12.4,
  downloadMbps: 45.7,
  isMeasured: true,
  deviceType: 'mobile',
  timestamp: 1754470920000,
);

const _heuristicScan = MyScan(
  id: 'scan-2',
  lat: 6.45,
  lng: 3.4,
  ispDisplayName: '9mobile',
  verifiedAsn: null,
  latencyMs: 90,
  jitterMs: 8,
  uploadMbps: 0,
  downloadMbps: 0,
  isMeasured: false,
  deviceType: 'tablet',
  timestamp: 1754470800000,
);

void main() {
  Future<void> pumpScreen(WidgetTester tester, {required MyScansFetcher fetchScans}) async {
    await tester.pumpWidget(
      ProviderScope(
        child: CupertinoApp(home: ActivityScreen(fetchScans: fetchScans)),
      ),
    );
  }

  testWidgets('shows a spinner while loading, then the list once resolved', (tester) async {
    final completer = Completer<List<MyScan>>();

    await pumpScreen(tester, fetchScans: () => completer.future);

    expect(find.byType(MapeeSkeleton), findsWidgets);

    completer.complete([_measuredScan, _heuristicScan]);
    await tester.pump();
    await tester.pump();

    expect(find.byType(MapeeSkeleton), findsNothing);
    expect(find.text('MTN Nigeria'), findsOneWidget);
    expect(find.text('9mobile'), findsOneWidget);
  });

  testWidgets('a measured scan shows its real Mbps figure in the subtitle', (tester) async {
    await pumpScreen(tester, fetchScans: () async => const [_measuredScan]);
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('45.7 Mbps'), findsOneWidget);
  });

  testWidgets('a heuristic scan never shows a fabricated Mbps figure', (tester) async {
    await pumpScreen(tester, fetchScans: () async => const [_heuristicScan]);
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('Heuristic ping'), findsOneWidget);
    expect(find.textContaining('Mbps'), findsNothing);
    expect(find.textContaining('0.0'), findsNothing);
  });

  testWidgets('a fetch failure shows an honest error state with a working retry', (tester) async {
    var callCount = 0;

    Future<List<MyScan>> fetch() async {
      callCount++;
      if (callCount == 1) throw Exception('network down');
      return const [_measuredScan];
    }

    await pumpScreen(tester, fetchScans: fetch);
    await tester.pump();
    await tester.pump();

    expect(find.text("Couldn't load your scans."), findsOneWidget);
    expect(find.text('Try Again'), findsOneWidget);
    expect(find.text('MTN Nigeria'), findsNothing);

    await tester.tap(find.text('Try Again'));
    await tester.pump();
    await tester.pump();

    expect(callCount, 2);
    expect(find.text("Couldn't load your scans."), findsNothing);
    expect(find.text('MTN Nigeria'), findsOneWidget);
  });

  testWidgets('a genuinely empty result shows honest empty copy, not error styling', (tester) async {
    await pumpScreen(tester, fetchScans: () async => const []);
    await tester.pump();
    await tester.pump();

    expect(find.text("You haven't run any scans yet."), findsOneWidget);
    expect(find.text('Try Again'), findsNothing);
    expect(find.text("Couldn't load your scans."), findsNothing);
  });
}
