import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/services/measurement/tcp_latency_service.dart';

void main() {
  late ServerSocket server;
  late StreamSubscription<Socket> subscription;

  tearDown(() async {
    await subscription.cancel();
    await server.close();
  });

  test('measures real TCP connect times against a loopback server', () async {
    server = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    subscription = server.listen((socket) => socket.destroy());

    final service = TcpLatencyService();
    final result = await service.measure(
      host: server.address.address,
      port: server.port,
      sampleCount: 5,
    );

    expect(result.hasData, isTrue);
    expect(result.samples, hasLength(5));
    expect(result.failedAttempts, 0);
    expect(result.samples, everyElement(greaterThanOrEqualTo(0)));
    expect(result.averageMs, greaterThanOrEqualTo(0));
  });

  test('handles a refused connection without throwing', () async {
    server = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    final refusedPort = server.port;
    subscription = server.listen((socket) => socket.destroy());
    await server.close();

    final service = TcpLatencyService();
    final result = await service.measure(
      host: InternetAddress.loopbackIPv4.address,
      port: refusedPort,
      sampleCount: 3,
    );

    server = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    subscription = server.listen((socket) => socket.destroy());

    expect(result.hasData, isFalse);
    expect(result.samples, isEmpty);
    expect(result.failedAttempts, 3);
  });

  test('collects partial samples when some attempts fail mid-batch', () async {
    server = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    final port = server.port;
    var accepted = 0;
    subscription = server.listen((socket) {
      accepted++;
      socket.destroy();
      if (accepted == 2) {
        server.close();
      }
    });

    final service = TcpLatencyService();
    final result = await service.measure(
      host: InternetAddress.loopbackIPv4.address,
      port: port,
      sampleCount: 4,
    );

    server = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    subscription = server.listen((socket) => socket.destroy());

    expect(result.samples.length + result.failedAttempts, 4);
    expect(result.failedAttempts, greaterThan(0));
    expect(result.samples, isNotEmpty);
  });
}
