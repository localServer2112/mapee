import 'dart:io';

import '../../domain/entities/latency_sample.dart';
import '../../domain/latency.dart';

class TcpLatencyService {
  // 1.1.1.1:443 (Cloudflare's anycast resolver) needs no DNS lookup, so
  // resolution latency never contaminates the measurement, and it's reliably
  // reachable from Nigerian networks.
  static const String defaultHost = '1.1.1.1';
  static const int defaultPort = 443;

  Future<LatencyResult> measure({
    String host = defaultHost,
    int port = defaultPort,
    int sampleCount = 5,
    Duration timeout = const Duration(seconds: 3),
  }) async {
    final samples = <int>[];
    var failedAttempts = 0;

    for (var i = 0; i < sampleCount; i++) {
      final sample = await _connectOnce(host, port, timeout);
      if (sample == null) {
        failedAttempts++;
      } else {
        samples.add(sample);
      }
    }

    final average = calculateAverageLatency(samples);
    return LatencyResult(
      samples: samples,
      failedAttempts: failedAttempts,
      averageMs: average,
      medianMs: calculateMedianLatency(samples),
      jitterMs: calculateJitter(samples),
      status: getLatencyStatus(average),
    );
  }

  Future<int?> _connectOnce(String host, int port, Duration timeout) async {
    final stopwatch = Stopwatch()..start();
    Socket? socket;
    try {
      socket = await Socket.connect(host, port, timeout: timeout);
      stopwatch.stop();
      return stopwatch.elapsedMilliseconds;
    } on SocketException {
      return null;
    } finally {
      socket?.destroy();
    }
  }
}
