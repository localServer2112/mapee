import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/install/install_store.dart';
import 'package:mapee_mobile/data/repositories/install_repository.dart';

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

  test('no stored token registers an install, then stores and returns the new token', () async {
    var requestCount = 0;
    unawaited(
      server.first.then((request) async {
        requestCount++;
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({'id': 'install-1', 'token': 'tok-abc'}));
        await request.response.close();
      }),
    );

    final store = InstallStore();
    final repo = InstallRepository(ApiClient(baseUrl: baseUrl), store);

    final token = await repo.ensureInstall();

    expect(token, 'tok-abc');
    expect(requestCount, 1);
    expect(await store.getToken(), 'tok-abc');
  });

  test('an existing stored token is returned without calling the install endpoint', () async {
    var requestCount = 0;
    server.listen((request) async {
      requestCount++;
      request.response.statusCode = HttpStatus.internalServerError;
      await request.response.close();
    });

    final store = InstallStore();
    await store.setToken('already-there');
    final repo = InstallRepository(ApiClient(baseUrl: baseUrl), store);

    final token = await repo.ensureInstall();

    expect(token, 'already-there');
    expect(requestCount, 0);
  });

  test('concurrent calls before the first resolves share one network call and one token', () async {
    var requestCount = 0;
    server.listen((request) async {
      requestCount++;
      await Future<void>.delayed(const Duration(milliseconds: 20));
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode({'id': 'install-2', 'token': 'tok-xyz'}));
      await request.response.close();
    });

    final store = InstallStore();
    final repo = InstallRepository(ApiClient(baseUrl: baseUrl), store);

    final results = await Future.wait([repo.ensureInstall(), repo.ensureInstall()]);

    expect(results, ['tok-xyz', 'tok-xyz']);
    expect(requestCount, 1);
    expect(await store.getToken(), 'tok-xyz');
  });
}
