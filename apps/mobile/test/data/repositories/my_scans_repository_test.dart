import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/install/install_store.dart';
import 'package:mapee_mobile/data/repositories/install_repository.dart';
import 'package:mapee_mobile/data/repositories/my_scans_repository.dart';

void main() {
  late HttpServer server;
  late String baseUrl;
  late InstallRepository installs;
  late List<Uri> requestedUris;
  late List<String?> authorizationHeaders;

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    requestedUris = [];
    authorizationHeaders = [];
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUrl = 'http://${server.address.address}:${server.port}';

    final store = InstallStore();
    await store.setToken('tok-abc');
    installs = InstallRepository(ApiClient(baseUrl: baseUrl), store);
  });

  tearDown(() async {
    await server.close(force: true);
  });

  test('maps every ScanDetail field into MyScan, including the ISP enum to display-name conversion', () async {
    unawaited(
      server.first.then((request) async {
        requestedUris.add(request.uri);
        authorizationHeaders.add(request.headers.value('authorization'));
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          jsonEncode([
            {
              'id': 'scan-1',
              'lat': 6.5244,
              'lng': 3.3792,
              'reportedISP': 'MTN Nigeria',
              'verifiedASN': 'AS29465',
              'latencyMs': 62,
              'jitter': 5,
              'uploadSpeed': 12.4,
              'downloadSpeed': 45.7,
              'measurementMethod': 'measured',
              'deviceType': 'mobile',
              'timestamp': 1754470920000,
              'isLocationExact': true,
            },
            {
              'id': 'scan-2',
              'lat': 6.45,
              'lng': 3.4,
              'reportedISP': '9mobile',
              'verifiedASN': null,
              'latencyMs': 90,
              'jitter': 8,
              'uploadSpeed': 0,
              'downloadSpeed': 0,
              'measurementMethod': 'heuristic',
              'deviceType': 'tablet',
              'timestamp': 1754470800000,
              'isLocationExact': true,
            },
          ]),
        );
        await request.response.close();
      }),
    );

    final repo = MyScansRepository(ApiClient(baseUrl: baseUrl), installs);
    final scans = await repo.fetchMyScans();

    expect(scans, hasLength(2));

    final first = scans[0];
    expect(first.id, 'scan-1');
    expect(first.lat, 6.5244);
    expect(first.lng, 3.3792);
    expect(first.ispDisplayName, 'MTN Nigeria');
    expect(first.verifiedAsn, 'AS29465');
    expect(first.latencyMs, 62);
    expect(first.jitterMs, 5);
    expect(first.uploadMbps, 12.4);
    expect(first.downloadMbps, 45.7);
    expect(first.isMeasured, isTrue);
    expect(first.deviceType, 'mobile');
    expect(first.timestamp, 1754470920000);

    final second = scans[1];
    expect(second.ispDisplayName, '9mobile');
    expect(second.verifiedAsn, isNull);
    expect(second.isMeasured, isFalse);
    expect(second.deviceType, 'tablet');

    expect(requestedUris, hasLength(1));
    expect(requestedUris.first.path, '/v1/me/scans');
    expect(authorizationHeaders, ['Bearer tok-abc']);
  });

  test('returns an empty list for an empty successful response body, without throwing', () async {
    unawaited(
      server.first.then((request) async {
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(<Object>[]));
        await request.response.close();
      }),
    );

    final repo = MyScansRepository(ApiClient(baseUrl: baseUrl), installs);
    final scans = await repo.fetchMyScans();

    expect(scans, isEmpty);
  });

  test('a server error causes fetchMyScans to throw, rather than silently returning an empty list', () async {
    unawaited(
      server.first.then((request) async {
        request.response.statusCode = HttpStatus.internalServerError;
        await request.response.close();
      }),
    );

    final repo = MyScansRepository(ApiClient(baseUrl: baseUrl), installs);

    expect(repo.fetchMyScans(), throwsA(isA<Exception>()));
  });
}
