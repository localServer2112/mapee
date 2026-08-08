import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_api/mapee_api.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/install/install_store.dart';
import 'package:mapee_mobile/data/repositories/install_repository.dart';
import 'package:mapee_mobile/data/repositories/scan_submission_repository.dart';

void main() {
  late HttpServer server;
  late String baseUrl;

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUrl = 'http://${server.address.address}:${server.port}';
  });

  tearDown(() async {
    await server.close(force: true);
  });

  test('a successful submission returns the new scan id', () async {
    unawaited(
      server.first.then((request) async {
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          jsonEncode({'success': 'true','id': 'scan-123', 'timestamp': 1700000000}),
        );
        await request.response.close();
      }),
    );

    final store = InstallStore();
    await store.setToken('install-token');
    final api = ApiClient(baseUrl: baseUrl);
    final installs = InstallRepository(api, store);
    final repo = ScanSubmissionRepository(api, installs);

    final id = await repo.submitScan(
      lat: 6.5244,
      lng: 3.3792,
      reportedIsp: ISPName.mTNNigeria,
      latencyMs: 40,
      jitter: 5,
      uploadSpeed: 10.5,
      downloadSpeed: 25.2,
      deviceType: DeviceType.mobile,
    );

    expect(id, 'scan-123');
  });

  test('the request carries an Authorization header with the install bearer token', () async {
    String? receivedAuthHeader;
    unawaited(
      server.first.then((request) async {
        receivedAuthHeader = request.headers.value(HttpHeaders.authorizationHeader);
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          jsonEncode({'success': 'true','id': 'scan-456', 'timestamp': 1700000000}),
        );
        await request.response.close();
      }),
    );

    final store = InstallStore();
    await store.setToken('secret-token');
    final api = ApiClient(baseUrl: baseUrl);
    final installs = InstallRepository(api, store);
    final repo = ScanSubmissionRepository(api, installs);

    await repo.submitScan(
      lat: 6.5244,
      lng: 3.3792,
      reportedIsp: ISPName.airtelNigeria,
      latencyMs: 40,
      jitter: 5,
      uploadSpeed: 10.5,
      downloadSpeed: 25.2,
      deviceType: DeviceType.mobile,
    );

    expect(receivedAuthHeader, 'Bearer secret-token');
  });
}
