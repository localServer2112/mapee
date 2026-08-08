import '../../domain/entities/area_stats.dart';
import '../api/api_client.dart';

/// `features/` never calls `ApiClient` directly — it goes through a
/// repository (plan §2.2), which is also the seam Drift-backed caching
/// slots into once that dependency conflict (see pubspec.yaml) is resolved.
class AreaRepository {
  AreaRepository(this._api);

  final ApiClient _api;

  /// [bbox] is `south,west,north,east`, matching `/v1/areas`'s contract.
  Future<List<AreaStats>> fetchAreas(String bbox, {int? zoom}) async {
    final response = await _api.map.v1AreasGet(bbox: bbox, zoom: zoom);
    final areas = response.data;
    if (areas == null) return const [];

    return areas
        .map(
          (a) => AreaStats(
            hexId: a.id,
            centerLat: a.centerLat.toDouble(),
            centerLng: a.centerLng.toDouble(),
            avgLatencyMs: a.avgLatency,
            minLatencyMs: a.minLatency,
            maxLatencyMs: a.maxLatency,
            pingCount: a.scanCount,
            topIsp: a.topISP,
            confidenceScore: a.confidence,
            consistency: a.consistency,
          ),
        )
        .toList();
  }
}
