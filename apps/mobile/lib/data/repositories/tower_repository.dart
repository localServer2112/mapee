import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapee_api/mapee_api.dart' hide CellTower;

import '../../app/providers.dart';
import '../../domain/entities/cell_tower.dart';
import '../api/api_client.dart';

/// `features/` never calls `ApiClient` directly — it goes through a
/// repository (plan §2.2), mirroring `AreaRepository.fetchAreas`'s shape.
class TowerRepository {
  TowerRepository(this._api);

  final ApiClient _api;

  /// [bbox] is `south,west,north,east`, matching `/v1/towers`'s contract.
  Future<List<CellTower>> fetchTowers(String bbox) async {
    try {
      final response = await _api.location.v1TowersGet(bbox: bbox);
      final towers = response.data;
      if (towers == null) return const [];

      return towers
          .map(
            (t) => CellTower(
              id: t.id,
              lat: t.lat.toDouble(),
              lng: t.lng.toDouble(),
              type: t.type == CellTowerTypeEnum.n5g ? CellTowerType.fiveG : CellTowerType.fourG,
              mcc: t.mcc,
              mnc: t.mnc,
              lac: t.lac,
              cellId: t.cellId,
            ),
          )
          .toList();
    } on DioException {
      return const [];
    }
  }
}

final towerRepositoryProvider = Provider<TowerRepository>(
  (ref) => TowerRepository(ref.watch(apiClientProvider)),
);
