import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/tower_repository.dart';
import 'package:mapee_mobile/domain/entities/cell_tower.dart';

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

  test('returns mapped CellTower results for a successful response', () async {
    unawaited(
      server.first.then((request) async {
        requestedUris.add(request.uri);
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          jsonEncode([
            {
              'id': '621-20-1-1',
              'lat': 6.5244,
              'lng': 3.3792,
              'type': '4G',
              'mcc': 621,
              'mnc': 20,
              'lac': 1,
              'cellId': 1,
            },
            {
              'id': '621-30-2-2',
              'lat': 6.4698,
              'lng': 3.5852,
              'type': '5G',
              'mcc': 621,
              'mnc': 30,
              'lac': 2,
              'cellId': 2,
            },
          ]),
        );
        await request.response.close();
      }),
    );

    final repo = TowerRepository(ApiClient(baseUrl: baseUrl));
    final towers = await repo.fetchTowers('6.4,3.3,6.6,3.6');

    expect(towers, hasLength(2));
    expect(towers[0].id, '621-20-1-1');
    expect(towers[0].lat, 6.5244);
    expect(towers[0].lng, 3.3792);
    expect(towers[0].type, CellTowerType.fourG);
    expect(towers[0].mcc, 621);
    expect(towers[0].mnc, 20);
    expect(towers[0].lac, 1);
    expect(towers[0].cellId, 1);
    expect(towers[1].type, CellTowerType.fiveG);

    expect(requestedUris, hasLength(1));
    expect(requestedUris.first.queryParameters['bbox'], '6.4,3.3,6.6,3.6');
  });

  test('returns an empty list for an empty successful response body', () async {
    unawaited(
      server.first.then((request) async {
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(<Object>[]));
        await request.response.close();
      }),
    );

    final repo = TowerRepository(ApiClient(baseUrl: baseUrl));
    final towers = await repo.fetchTowers('0,0,1,1');

    expect(towers, isEmpty);
  });

  test('returns an empty list instead of throwing on a server error', () async {
    unawaited(
      server.first.then((request) async {
        request.response.statusCode = HttpStatus.internalServerError;
        await request.response.close();
      }),
    );

    final repo = TowerRepository(ApiClient(baseUrl: baseUrl));
    final towers = await repo.fetchTowers('0,0,1,1');

    expect(towers, isEmpty);
  });
}
