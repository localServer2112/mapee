import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/config_repository.dart';

Future<HttpServer> _serve(Map<String, dynamic> body, {int statusCode = 200}) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen((request) async {
    request.response.statusCode = statusCode;
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode(body));
    await request.response.close();
  });
  return server;
}

const _validConfigBody = {
  'ispList': ['MTN Nigeria', 'Airtel Nigeria'],
  'latencyThresholds': {'good': 50, 'fair': 150},
  'dataFreshness': {'freshDays': 7, 'staleDays': 30, 'expiredDays': 30},
  'measurementEndpoints': {
    'download': 'https://example.com/download',
    'upload': 'https://example.com/upload',
  },
  'minSupportedVersion': '1.0.0',
};

void main() {
  test('fetchConfig maps the response into AppConfig', () async {
    final server = await _serve(_validConfigBody);
    addTearDown(server.close);

    final repo = ConfigRepository(ApiClient(baseUrl: 'http://${server.address.address}:${server.port}'));
    final config = await repo.fetchConfig();

    expect(config.ispList, ['MTN Nigeria', 'Airtel Nigeria']);
    expect(config.latencyGoodMs, 50);
    expect(config.latencyFairMs, 150);
    expect(config.measurementDownloadUrl, 'https://example.com/download');
    expect(config.measurementUploadUrl, 'https://example.com/upload');
  });

  test('fetchConfig caches — only one request for repeated calls', () async {
    var requestCount = 0;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((request) async {
      requestCount++;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode(_validConfigBody));
      await request.response.close();
    });
    addTearDown(server.close);

    final repo = ConfigRepository(ApiClient(baseUrl: 'http://${server.address.address}:${server.port}'));
    await repo.fetchConfig();
    await repo.fetchConfig();

    expect(requestCount, 1);
  });

  test('fetchConfig throws when the server errors', () async {
    final server = await _serve({}, statusCode: 500);
    addTearDown(server.close);

    final repo = ConfigRepository(ApiClient(baseUrl: 'http://${server.address.address}:${server.port}'));

    expect(() => repo.fetchConfig(), throwsA(anything));
  });
}
