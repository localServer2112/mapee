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
import 'package:mapee_mobile/data/scan_outbox/scan_outbox.dart';
import 'package:mapee_mobile/data/scan_outbox/scan_outbox_entry.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late HttpServer server;
  late String baseUrl;
  final outboxes = <ScanOutbox>[];

  ScanOutbox track(ScanOutbox outbox) {
    outboxes.add(outbox);
    return outbox;
  }

  Future<ScanSubmissionRepository> repositoryFor(String url) async {
    final store = InstallStore();
    await store.setToken('install-token');
    final api = ApiClient(baseUrl: url);
    final installs = InstallRepository(api, store);
    return ScanSubmissionRepository(api, installs);
  }

  ScanOutboxEntry sampleEntry() => ScanOutboxEntry.create(
        lat: 6.5244,
        lng: 3.3792,
        reportedIsp: ISPName.mTNNigeria,
        latencyMs: 40,
        jitter: 5,
        uploadSpeed: 10.5,
        downloadSpeed: 25.2,
        deviceType: DeviceType.mobile,
      );

  void respondSuccess(HttpRequest request, {String id = 'scan-1'}) {
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode({'success': 'true', 'id': id, 'timestamp': 1700000000}));
  }

  void respondError(HttpRequest request) {
    request.response.statusCode = HttpStatus.internalServerError;
  }

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUrl = 'http://${server.address.address}:${server.port}';
  });

  tearDown(() async {
    for (final outbox in outboxes) {
      outbox.dispose();
    }
    outboxes.clear();
    await server.close(force: true);
  });

  test('enqueue immediately attempts sync and removes the entry from currentPending and storage on success', () async {
    unawaited(
      server.first.then((request) async {
        respondSuccess(request);
        await request.response.close();
      }),
    );

    final repo = await repositoryFor(baseUrl);
    final prefs = await SharedPreferences.getInstance();
    final outbox = track(ScanOutbox(repo, prefs: prefs));
    final entry = sampleEntry();

    await outbox.enqueue(entry);

    expect(outbox.currentPending, isEmpty);
    expect(prefs.getString('mapee.scan_outbox.pending'), jsonEncode(<dynamic>[]));
  });

  test('enqueue when the server errors keeps the entry queued with attempts incremented', () async {
    unawaited(
      server.first.then((request) async {
        respondError(request);
        await request.response.close();
      }),
    );

    final repo = await repositoryFor(baseUrl);
    final prefs = await SharedPreferences.getInstance();
    final outbox = track(ScanOutbox(repo, prefs: prefs));
    final entry = sampleEntry();

    await outbox.enqueue(entry);

    expect(outbox.currentPending, hasLength(1));
    expect(outbox.currentPending.single.id, entry.id);
    expect(outbox.currentPending.single.attempts, 1);

    final persisted = jsonDecode(prefs.getString('mapee.scan_outbox.pending')!) as List<dynamic>;
    expect(persisted, hasLength(1));
    expect((persisted.single as Map<String, dynamic>)['attempts'], 1);
  });

  test('retryNow picks up a previously-failed entry and succeeds once the server responds successfully', () async {
    var requestCount = 0;
    server.listen((request) async {
      requestCount++;
      if (requestCount == 1) {
        respondError(request);
      } else {
        respondSuccess(request);
      }
      await request.response.close();
    });

    final repo = await repositoryFor(baseUrl);
    final prefs = await SharedPreferences.getInstance();
    final outbox = track(ScanOutbox(repo, prefs: prefs));
    final entry = sampleEntry();

    await outbox.enqueue(entry);
    expect(outbox.currentPending, hasLength(1));
    expect(outbox.currentPending.single.attempts, 1);

    await outbox.retryNow();

    expect(outbox.currentPending, isEmpty);
    expect(requestCount, 2);
  });

  test('the same id is sent on every retry attempt for a given entry', () async {
    final receivedIds = <String>[];
    var requestCount = 0;
    server.listen((request) async {
      requestCount++;
      final body = jsonDecode(await utf8.decodeStream(request)) as Map<String, dynamic>;
      receivedIds.add(body['id'] as String);
      if (requestCount == 1) {
        respondError(request);
      } else {
        respondSuccess(request);
      }
      await request.response.close();
    });

    final repo = await repositoryFor(baseUrl);
    final prefs = await SharedPreferences.getInstance();
    final outbox = track(ScanOutbox(repo, prefs: prefs));
    final entry = sampleEntry();

    await outbox.enqueue(entry);
    await outbox.retryNow();

    expect(receivedIds, hasLength(2));
    expect(receivedIds[0], entry.id);
    expect(receivedIds[1], entry.id);
    expect(receivedIds[0], receivedIds[1]);
  });

  test('persisted state survives across two separate ScanOutbox instances sharing the same SharedPreferences', () async {
    unawaited(
      server.first.then((request) async {
        respondError(request);
        await request.response.close();
      }),
    );

    final repo = await repositoryFor(baseUrl);
    final prefs = await SharedPreferences.getInstance();
    final firstOutbox = track(ScanOutbox(repo, prefs: prefs));
    final entry = sampleEntry();

    await firstOutbox.enqueue(entry);
    expect(firstOutbox.currentPending, hasLength(1));

    final secondOutbox = track(ScanOutbox(repo, prefs: prefs));
    await secondOutbox.loadPending();

    expect(secondOutbox.currentPending, hasLength(1));
    expect(secondOutbox.currentPending.single.id, entry.id);
    expect(secondOutbox.currentPending.single.attempts, 1);
  });
}
