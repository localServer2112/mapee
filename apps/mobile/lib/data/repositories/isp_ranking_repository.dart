import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapee_api/mapee_api.dart';

import '../../app/providers.dart';
import '../../domain/entities/isp_ranking.dart';
import '../api/api_client.dart';

/// `features/` never calls `ApiClient` directly — it goes through a
/// repository (plan §2.2), mirroring `AreaRepository.fetchAreas`'s shape.
///
/// An empty result is the expected steady state today: `apps/api`'s
/// `isp_rankings` view only includes rows with `measurement_method =
/// 'measured'`, and no client can run a real throughput test yet (Track B
/// Phase 3). `features/insights` renders that as an honest empty state, not
/// an error.
class IspRankingRepository {
  IspRankingRepository(this._api);

  final ApiClient _api;

  Future<List<IspRanking>> fetchRankings() async {
    try {
      final response = await _api.insights.v1IspRankingsGet();
      final rankings = response.data;
      if (rankings == null) return const [];

      return rankings
          .map(
            (r) => IspRanking(
              // ISPName's own `.name` is the Dart-identifier form (e.g.
              // "mTNNigeria"); the human-readable string is the wire name
              // that the generated serializer already knows about.
              // Dispatched dynamically so this file doesn't need a direct
              // dependency on built_value just for the serializer's type.
              isp: (ISPName.serializer as dynamic).serialize(serializers, r.isp) as String,
              avgLatencyMs: r.avgLatency,
              medianLatencyMs: r.medianLatency,
              avgJitterMs: r.avgJitter,
              sampleCount: r.sampleCount,
              avgDownloadMbps: r.avgDownload.toDouble(),
              avgUploadMbps: r.avgUpload.toDouble(),
            ),
          )
          .toList();
    } on DioException {
      return const [];
    }
  }
}

final ispRankingRepositoryProvider = Provider<IspRankingRepository>(
  (ref) => IspRankingRepository(ref.watch(apiClientProvider)),
);
