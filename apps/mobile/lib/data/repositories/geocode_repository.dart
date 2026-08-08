import 'package:dio/dio.dart';

import '../../domain/entities/geocode_result.dart';
import '../api/api_client.dart';

/// `features/` never calls `ApiClient` directly — it goes through a
/// repository (plan §2.2). Used by the map tab's search-as-you-type pill,
/// so it must never throw: a search box that crashes on a flaky network is
/// worse than one that silently shows no results.
class GeocodeRepository {
  GeocodeRepository(this._api);

  final ApiClient _api;

  Future<List<GeocodeLocation>> search(String query, {String? country}) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return const [];

    try {
      final response = await _api.location.v1GeocodeGet(q: trimmed, country: country);
      final results = response.data;
      if (results == null) return const [];

      return results
          .map(
            (r) => GeocodeLocation(
              displayName: r.displayName,
              lat: r.lat.toDouble(),
              lng: r.lng.toDouble(),
            ),
          )
          .toList();
    } on DioException {
      return const [];
    }
  }
}
