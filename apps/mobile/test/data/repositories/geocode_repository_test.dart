import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/geocode_repository.dart';

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

  test('returns mapped GeocodeLocation results for a successful response', () async {
    unawaited(
      server.first.then((request) async {
        requestedUris.add(request.uri);
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          jsonEncode([
            {'displayName': 'Lagos, Nigeria', 'lat': 6.5244, 'lng': 3.3792},
            {'displayName': 'Lekki, Lagos', 'lat': 6.4698, 'lng': 3.5852},
          ]),
        );
        await request.response.close();
      }),
    );

    final repo = GeocodeRepository(ApiClient(baseUrl: baseUrl));
    final results = await repo.search('Lagos');

    expect(results, hasLength(2));
    expect(results[0].displayName, 'Lagos, Nigeria');
    expect(results[0].lat, 6.5244);
    expect(results[0].lng, 3.3792);
    expect(results[1].displayName, 'Lekki, Lagos');

    expect(requestedUris, hasLength(1));
    expect(requestedUris.first.queryParameters['q'], 'Lagos');
  });

  test('passes country through as a query parameter', () async {
    unawaited(
      server.first.then((request) async {
        requestedUris.add(request.uri);
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(<Object>[]));
        await request.response.close();
      }),
    );

    final repo = GeocodeRepository(ApiClient(baseUrl: baseUrl));
    await repo.search('Lagos', country: 'ng');

    expect(requestedUris.first.queryParameters['country'], 'ng');
  });

  test('returns an empty list without hitting the network for a blank query', () async {
    final repo = GeocodeRepository(ApiClient(baseUrl: baseUrl));

    final results = await repo.search('   ');

    expect(results, isEmpty);
  });

  test('returns an empty list for an empty successful response body', () async {
    unawaited(
      server.first.then((request) async {
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(<Object>[]));
        await request.response.close();
      }),
    );

    final repo = GeocodeRepository(ApiClient(baseUrl: baseUrl));
    final results = await repo.search('nowhere');

    expect(results, isEmpty);
  });

  test('returns an empty list instead of throwing on a server error', () async {
    unawaited(
      server.first.then((request) async {
        request.response.statusCode = HttpStatus.internalServerError;
        await request.response.close();
      }),
    );

    final repo = GeocodeRepository(ApiClient(baseUrl: baseUrl));
    final results = await repo.search('Lagos');

    expect(results, isEmpty);
  });
}
