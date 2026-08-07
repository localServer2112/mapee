import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../domain/entities/asn_info.dart';
import '../api/api_client.dart';

/// `features/` never calls `ApiClient` directly — it goes through a
/// repository (plan §2.2), mirroring `TowerRepository.fetchTowers`'s shape:
/// never throws, since a failed ASN lookup should let `IspDetector` fall
/// back to the OS-carrier-name source instead of crashing.
class NetworkIdentifyRepository {
  NetworkIdentifyRepository(this._api);

  final ApiClient _api;

  Future<AsnInfo?> fetchAsnInfo() async {
    try {
      final response = await _api.location.v1NetworkIdentifyGet();
      final identify = response.data;
      if (identify == null) return null;

      return AsnInfo(
        isp: identify.isp,
        as: identify.as_,
        asname: identify.asname,
        org: identify.org,
      );
    } on DioException {
      return null;
    }
  }
}

final networkIdentifyRepositoryProvider = Provider<NetworkIdentifyRepository>(
  (ref) => NetworkIdentifyRepository(ref.watch(apiClientProvider)),
);
