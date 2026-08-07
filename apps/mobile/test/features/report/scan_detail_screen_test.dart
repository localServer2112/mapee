import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/domain/entities/my_scan.dart';
import 'package:mapee_mobile/features/report/scan_detail_screen.dart';

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
  Future<void> pumpDetail(WidgetTester tester, MyScan scan) async {
    await tester.pumpWidget(CupertinoApp(home: ScanDetailScreen(scan: scan)));
  }

  testWidgets('a measured scan renders real latency, jitter, download and upload values', (tester) async {
    await pumpDetail(tester, _measuredScan);

    expect(find.text('MTN Nigeria'), findsOneWidget);
    expect(find.text('62 ms'), findsOneWidget);
    expect(find.text('5 ms'), findsOneWidget);
    expect(find.text('45.7 Mbps'), findsOneWidget);
    expect(find.text('12.4 Mbps'), findsOneWidget);
    expect(find.textContaining('Measured on mobile'), findsOneWidget);
    expect(find.text('Not measured'), findsNothing);
  });

  testWidgets('a heuristic scan renders an honest "Not measured" state instead of a fabricated Mbps figure', (
    tester,
  ) async {
    await pumpDetail(tester, _heuristicScan);

    expect(find.text('9mobile'), findsOneWidget);
    expect(find.text('90 ms'), findsOneWidget);
    expect(find.text('8 ms'), findsOneWidget);
    expect(find.text('Not measured'), findsNWidgets(2));
    expect(find.textContaining('Mbps'), findsNothing);
    expect(find.textContaining('Heuristic ping on tablet'), findsOneWidget);
  });
}
