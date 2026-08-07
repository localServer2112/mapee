import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_api/mapee_api.dart';

import 'package:mapee_mobile/features/scan/isp_step.dart';
import 'package:mapee_mobile/services/network/isp_detector.dart';

void main() {
  Future<void> pumpStep(
    WidgetTester tester, {
    required IspDetector detector,
    required void Function(ISPName isp) onConfirmed,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [ispDetectorProvider.overrideWithValue(detector)],
        child: CupertinoApp(
          home: IspStep(onConfirmed: onConfirmed),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('successful detection shows the confirm row and confirms the right ISP', (tester) async {
    ISPName? confirmed;
    final detector = IspDetector(
      fetchAsnInfo: () async => null,
      carrierNameProvider: () async => 'MTN Nigeria',
    );

    await pumpStep(tester, detector: detector, onConfirmed: (isp) => confirmed = isp);

    expect(find.text('MTN Nigeria'), findsOneWidget);
    expect(find.text('Confirm'), findsOneWidget);

    await tester.tap(find.text('Confirm'));
    await tester.pump();

    expect(confirmed, ISPName.mTNNigeria);
  });

  testWidgets('tapping "Not this one" reveals the searchable list', (tester) async {
    final detector = IspDetector(
      fetchAsnInfo: () async => null,
      carrierNameProvider: () async => 'MTN Nigeria',
    );

    await pumpStep(tester, detector: detector, onConfirmed: (_) {});

    expect(find.text('Choose your network'), findsNothing);

    await tester.tap(find.text('Not this one'));
    await tester.pump();

    expect(find.text('Choose your network'), findsOneWidget);
    expect(find.text('Airtel Nigeria'), findsOneWidget);
  });

  testWidgets('failed detection skips straight to the searchable list', (tester) async {
    final detector = IspDetector(
      fetchAsnInfo: () async => null,
      carrierNameProvider: () async => null,
    );

    await pumpStep(tester, detector: detector, onConfirmed: (_) {});

    expect(find.text('Confirm'), findsNothing);
    expect(find.text('Choose your network'), findsOneWidget);
  });

  testWidgets('typing in the search field filters the list', (tester) async {
    final detector = IspDetector(
      fetchAsnInfo: () async => null,
      carrierNameProvider: () async => null,
    );

    await pumpStep(tester, detector: detector, onConfirmed: (_) {});

    expect(find.text('MTN Nigeria'), findsOneWidget);
    expect(find.text('Airtel Nigeria'), findsOneWidget);

    await tester.enterText(find.byType(CupertinoSearchTextField), 'glo');
    await tester.pump();

    expect(find.text('Globacom (Glo)'), findsOneWidget);
    expect(find.text('MTN Nigeria'), findsNothing);
    expect(find.text('Airtel Nigeria'), findsNothing);
  });

  testWidgets('tapping a list row with an awkward generated identifier maps correctly', (tester) async {
    ISPName? confirmed;
    final detector = IspDetector(
      fetchAsnInfo: () async => null,
      carrierNameProvider: () async => null,
    );

    await pumpStep(tester, detector: detector, onConfirmed: (isp) => confirmed = isp);

    await tester.enterText(find.byType(CupertinoSearchTextField), 'Tizeti');
    await tester.pump();

    expect(find.text('Tizeti (wifi.com.ng)'), findsOneWidget);
    await tester.tap(find.text('Tizeti (wifi.com.ng)'));
    await tester.pump();

    expect(confirmed, ISPName.tizetiLeftParenthesisWifiPeriodComPeriodNgRightParenthesis);
  });

  testWidgets('tapping Globacom (Glo) maps to the correct enum value', (tester) async {
    ISPName? confirmed;
    final detector = IspDetector(
      fetchAsnInfo: () async => null,
      carrierNameProvider: () async => null,
    );

    await pumpStep(tester, detector: detector, onConfirmed: (isp) => confirmed = isp);

    await tester.tap(find.text('Globacom (Glo)'));
    await tester.pump();

    expect(confirmed, ISPName.globacomLeftParenthesisGloRightParenthesis);
  });
}
