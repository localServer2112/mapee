import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/services/connectivity/connectivity_service.dart';

void main() {
  test('onlineStatus emits true for wifi/mobile and false for none', () async {
    final controller = StreamController<List<ConnectivityResult>>();
    final service = ConnectivityService(
      onConnectivityChanged: controller.stream,
      checkConnectivity: () async => [ConnectivityResult.none],
    );

    final emitted = <bool>[];
    final subscription = service.onlineStatus.listen(emitted.add);

    controller.add([ConnectivityResult.wifi]);
    controller.add([ConnectivityResult.mobile]);
    controller.add([ConnectivityResult.none]);
    await Future<void>.delayed(Duration.zero);

    expect(emitted, [true, true, false]);

    await subscription.cancel();
    await controller.close();
  });

  test('isOnlineNow reflects the current state before any stream event arrives', () async {
    // The stream is never listened to here — closing an unlistened
    // single-subscription StreamController never completes, so this
    // deliberately skips close() rather than awaiting it.
    final controller = StreamController<List<ConnectivityResult>>();
    final service = ConnectivityService(
      onConnectivityChanged: controller.stream,
      checkConnectivity: () async => [ConnectivityResult.wifi],
    );

    // isOnlineNow is backed by checkConnectivity, a separate function from
    // the stream, so it's checkable with zero stream events ever emitted.
    expect(await service.isOnlineNow, isTrue);
  });

  test('isOnlineNow is false when the current interface is none', () async {
    final controller = StreamController<List<ConnectivityResult>>();
    final service = ConnectivityService(
      onConnectivityChanged: controller.stream,
      checkConnectivity: () async => [ConnectivityResult.none],
    );

    expect(await service.isOnlineNow, isFalse);
  });
}
