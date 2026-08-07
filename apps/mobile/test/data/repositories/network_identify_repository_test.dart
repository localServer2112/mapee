import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/network_identify_repository.dart';

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

const _validBody = {
  'isp': 'MTN Nigeria Communications Limited',
  'as': 'AS29465',
  'asname': 'MTN-NG',
  'org': 'MTN Nigeria Communications Limited',
};

void main() {
  test('fetchAsnInfo maps the response into AsnInfo', () async {
    final server = await _serve(_validBody);
    addTearDown(server.close);

    final repo = NetworkIdentifyRepository(
      ApiClient(baseUrl: 'http://${server.address.address}:${server.port}'),
    );
    final asnInfo = await repo.fetchAsnInfo();

    expect(asnInfo, isNotNull);
    expect(asnInfo!.isp, 'MTN Nigeria Communications Limited');
    expect(asnInfo.as, 'AS29465');
    expect(asnInfo.asname, 'MTN-NG');
    expect(asnInfo.org, 'MTN Nigeria Communications Limited');
  });

  test('fetchAsnInfo returns null instead of throwing on a server error', () async {
    final server = await _serve({}, statusCode: 500);
    addTearDown(server.close);

    final repo = NetworkIdentifyRepository(
      ApiClient(baseUrl: 'http://${server.address.address}:${server.port}'),
    );
    final asnInfo = await repo.fetchAsnInfo();

    expect(asnInfo, isNull);
  });
}
