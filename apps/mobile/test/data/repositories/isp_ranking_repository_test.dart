import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/isp_ranking_repository.dart';

void main() {
  late HttpServer server;
  late String baseUrl;
  late List<Uri> requestedUris;

  setUp(() async {
    requestedUris = [];
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUrl = 'http://${server.address.address}:${server.port}';
  });

  tearDown(() async {
    await server.close(force: true);
  });

  test('returns mapped IspRanking results, with human-readable ISP names', () async {
    unawaited(
      server.first.then((request) async {
        requestedUris.add(request.uri);
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          jsonEncode([
            {
              'isp': 'MTN Nigeria',
              'avgLatency': 142,
              'medianLatency': 130,
              'avgJitter': 12,
              'sampleCount': 1204,
              'avgDownload': 8.5,
              'avgUpload': 2.1,
            },
            {
              'isp': '9mobile',
              'avgLatency': 210,
              'medianLatency': 200,
              'avgJitter': 30,
              'sampleCount': 42,
              'avgDownload': 3,
              'avgUpload': 1,
            },
          ]),
        );
        await request.response.close();
      }),
    );

    final repo = IspRankingRepository(ApiClient(baseUrl: baseUrl));
    final rankings = await repo.fetchRankings();

    expect(rankings, hasLength(2));
    expect(rankings[0].isp, 'MTN Nigeria');
    expect(rankings[0].avgLatencyMs, 142);
    expect(rankings[0].medianLatencyMs, 130);
    expect(rankings[0].avgJitterMs, 12);
    expect(rankings[0].sampleCount, 1204);
    expect(rankings[0].avgDownloadMbps, 8.5);
    expect(rankings[0].avgUploadMbps, 2.1);
    expect(rankings[1].isp, '9mobile');

    expect(requestedUris, hasLength(1));
    expect(requestedUris.first.path, '/v1/isp-rankings');
  });

  test('returns an empty list for an empty successful response body', () async {
    unawaited(
      server.first.then((request) async {
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(<Object>[]));
        await request.response.close();
      }),
    );

    final repo = IspRankingRepository(ApiClient(baseUrl: baseUrl));
    final rankings = await repo.fetchRankings();

    expect(rankings, isEmpty);
  });

  test('returns an empty list instead of throwing on a server error', () async {
    unawaited(
      server.first.then((request) async {
        request.response.statusCode = HttpStatus.internalServerError;
        await request.response.close();
      }),
    );

    final repo = IspRankingRepository(ApiClient(baseUrl: baseUrl));
    final rankings = await repo.fetchRankings();

    expect(rankings, isEmpty);
  });
}
