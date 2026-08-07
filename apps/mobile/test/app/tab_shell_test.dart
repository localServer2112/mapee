import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/app/tab_shell.dart';
import 'package:mapee_mobile/services/connectivity/connectivity_service.dart';

void main() {
  const offlineText = "You're offline — some features may not work.";

  Future<StreamController<List<ConnectivityResult>>> pumpShell(
    WidgetTester tester, {
    required List<ConnectivityResult> initial,
  }) async {
    final controller = StreamController<List<ConnectivityResult>>.broadcast();
    final service = ConnectivityService(
      onConnectivityChanged: controller.stream,
      checkConnectivity: () async => initial,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [connectivityServiceProvider.overrideWithValue(service)],
        child: const CupertinoApp(home: TabShell()),
      ),
    );
    await tester.pump();
    return controller;
  }

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  testWidgets('banner hidden while online', (tester) async {
    final controller = await pumpShell(tester, initial: [ConnectivityResult.wifi]);
    expect(find.textContaining(offlineText), findsNothing);
    await controller.close();
  });

  testWidgets('banner appears on a transition to offline, with an honest message', (tester) async {
    final controller = await pumpShell(tester, initial: [ConnectivityResult.wifi]);

    controller.add([ConnectivityResult.none]);
    await tester.pump();
    await tester.pump();

    expect(find.text(offlineText), findsOneWidget);
    await controller.close();
  });

  testWidgets('banner disappears again on a transition back to online', (tester) async {
    final controller = await pumpShell(tester, initial: [ConnectivityResult.wifi]);

    controller.add([ConnectivityResult.none]);
    await tester.pump();
    await tester.pump();
    expect(find.text(offlineText), findsOneWidget);

    controller.add([ConnectivityResult.wifi]);
    await tester.pump();
    await tester.pump();
    expect(find.text(offlineText), findsNothing);

    await controller.close();
  });

  testWidgets('an online->online no-op emission does not toggle the banner', (tester) async {
    final controller = await pumpShell(tester, initial: [ConnectivityResult.wifi]);

    controller.add([ConnectivityResult.wifi]);
    await tester.pump();
    await tester.pump();

    expect(find.text(offlineText), findsNothing);
    await controller.close();
  });

  testWidgets('an offline->offline no-op emission does not re-toggle the banner', (tester) async {
    final controller = await pumpShell(tester, initial: [ConnectivityResult.wifi]);

    controller.add([ConnectivityResult.none]);
    await tester.pump();
    await tester.pump();
    expect(find.text(offlineText), findsOneWidget);

    controller.add([ConnectivityResult.none]);
    await tester.pump();
    await tester.pump();
    expect(find.text(offlineText), findsOneWidget);

    await controller.close();
  });

  testWidgets('fires a warning haptic only on a genuine online->offline transition', (tester) async {
    var vibrateCount = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'HapticFeedback.vibrate') vibrateCount++;
        return null;
      },
    );

    final controller = await pumpShell(tester, initial: [ConnectivityResult.wifi]);
    expect(vibrateCount, 0);

    controller.add([ConnectivityResult.wifi]);
    await tester.pump();
    await tester.pump();
    expect(vibrateCount, 0);

    controller.add([ConnectivityResult.none]);
    await tester.pump();
    await tester.pump();
    expect(vibrateCount, 1);

    controller.add([ConnectivityResult.none]);
    await tester.pump();
    await tester.pump();
    expect(vibrateCount, 1);

    controller.add([ConnectivityResult.wifi]);
    await tester.pump();
    await tester.pump();
    expect(vibrateCount, 1);

    await controller.close();
  });

  testWidgets('cold start already offline shows the banner but fires no haptic', (tester) async {
    var vibrateCount = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'HapticFeedback.vibrate') vibrateCount++;
        return null;
      },
    );

    final controller = await pumpShell(tester, initial: [ConnectivityResult.none]);

    expect(find.text(offlineText), findsOneWidget);
    expect(vibrateCount, 0);

    await controller.close();
  });
}
