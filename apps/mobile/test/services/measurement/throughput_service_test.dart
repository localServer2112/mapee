import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/config_repository.dart';
import 'package:mapee_mobile/domain/entities/throughput_result.dart';
import 'package:mapee_mobile/services/measurement/throughput_service.dart';

Map<String, dynamic> _configBody(String baseUrl) => {
      'ispList': <String>[],
      'latencyThresholds': {'good': 50, 'fair': 150},
      'dataFreshness': {'freshDays': 7, 'staleDays': 30, 'expiredDays': 30},
      'measurementEndpoints': {
        'download': '$baseUrl/download',
        'upload': '$baseUrl/upload',
      },
      'minSupportedVersion': '1.0.0',
    };

Future<List<ConnectivityResult>> _wifi() async => [ConnectivityResult.wifi];
Future<List<ConnectivityResult>> _cellular() async => [ConnectivityResult.mobile];

void main() {
  late HttpServer server;
  late String baseUrl;
  var uploadBytesReceived = 0;

  setUp(() async {
    uploadBytesReceived = 0;
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUrl = 'http://${server.address.address}:${server.port}';
  });

  tearDown(() async {
    await server.close(force: true);
  });

  Future<void> serveDefaults({
    int downloadBytes = 200 * 1024,
    int downloadChunk = 16 * 1024,
    Duration downloadChunkDelay = Duration.zero,
  }) async {
    server.listen((request) async {
      switch (request.uri.path) {
        case '/v1/config':
          request.response.headers.contentType = ContentType.json;
          request.response.write(jsonEncode(_configBody(baseUrl)));
          await request.response.close();
          break;
        case '/download':
          var sent = 0;
          try {
            while (sent < downloadBytes) {
              final n = math.min(downloadChunk, downloadBytes - sent);
              request.response.add(Uint8List(n));
              sent += n;
              await request.response.flush();
              if (downloadChunkDelay > Duration.zero) {
                await Future<void>.delayed(downloadChunkDelay);
              }
            }
            await request.response.close();
          } catch (_) {
            // Client aborted mid-stream (budget cap or timeout) — expected.
          }
          break;
        case '/upload':
          uploadBytesReceived = await request.fold<int>(0, (sum, chunk) => sum + chunk.length);
          request.response.statusCode = HttpStatus.ok;
          await request.response.close();
          break;
        default:
          request.response.statusCode = HttpStatus.notFound;
          await request.response.close();
      }
    });
  }

  test('measureDownload produces a positive Mbps figure from a real transfer', () async {
    await serveDefaults();
    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _wifi);

    final result = await service.measureDownload(maxBytes: 5 * 1024 * 1024);

    expect(result.outcome, ThroughputOutcome.success);
    expect(result.downloadMbps, isNotNull);
    expect(result.downloadMbps, greaterThan(0));
    expect(result.uploadMbps, isNull);
    expect(result.bytesTransferred, 200 * 1024);
  });

  test('measureUpload produces a positive Mbps figure from a real transfer', () async {
    await serveDefaults();
    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _wifi);

    final result = await service.measureUpload(bytesToSend: 200 * 1024);

    expect(result.outcome, ThroughputOutcome.success);
    expect(result.uploadMbps, isNotNull);
    expect(result.uploadMbps, greaterThan(0));
    expect(result.downloadMbps, isNull);
    expect(uploadBytesReceived, 200 * 1024);
  });

  test('data budget caps a download that would otherwise be much larger', () async {
    await serveDefaults(
      downloadBytes: 20 * 1024 * 1024,
      downloadChunk: 32 * 1024,
      downloadChunkDelay: const Duration(milliseconds: 3),
    );
    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _wifi);

    const budget = 256 * 1024;
    final result = await service.measureDownload(maxBytes: budget);

    expect(result.outcome, ThroughputOutcome.success);
    expect(result.bytesTransferred, greaterThan(0));
    expect(result.bytesTransferred, lessThan(20 * 1024 * 1024));
    expect(result.downloadMbps, isNotNull);
    expect(result.downloadMbps, greaterThan(0));
  });

  test('cellular consent blocks download when allowCellular is false', () async {
    await serveDefaults();
    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _cellular);

    final result = await service.measureDownload();

    expect(result.outcome, ThroughputOutcome.cellularConsentDenied);
    expect(result.downloadMbps, isNull);
    expect(result.bytesTransferred, 0);
  });

  test('cellular consent blocks upload when allowCellular is false', () async {
    await serveDefaults();
    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _cellular);

    final result = await service.measureUpload();

    expect(result.outcome, ThroughputOutcome.cellularConsentDenied);
    expect(result.uploadMbps, isNull);
    expect(uploadBytesReceived, 0);
  });

  test('cellular transfer proceeds when allowCellular is true', () async {
    await serveDefaults();
    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _cellular);

    final result = await service.measureDownload(allowCellular: true);

    expect(result.outcome, ThroughputOutcome.success);
    expect(result.downloadMbps, isNotNull);
  });

  test('wifi transfer proceeds without needing allowCellular', () async {
    await serveDefaults();
    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _wifi);

    final result = await service.measureUpload(bytesToSend: 50 * 1024);

    expect(result.outcome, ThroughputOutcome.success);
  });

  test('measureDownload surfaces networkError instead of a fake number when the server is unreachable', () async {
    await server.close(force: true);

    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _wifi);

    final result = await service.measureDownload();

    expect(result.outcome, isNot(ThroughputOutcome.success));
    expect(result.downloadMbps, isNull);
  });

  test('zero-byte budget is rejected without making a network call', () async {
    var configFetched = false;
    server.listen((request) async {
      configFetched = true;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode(_configBody(baseUrl)));
      await request.response.close();
    });

    final repo = ConfigRepository(ApiClient(baseUrl: baseUrl));
    final service = ThroughputService(repo, checkConnectivity: _wifi);

    final result = await service.measureDownload(maxBytes: 0);

    expect(result.outcome, ThroughputOutcome.budgetExceeded);
    expect(result.downloadMbps, isNull);
    expect(configFetched, isFalse);
  });
}
