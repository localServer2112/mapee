/// Pure-Dart entity (plan §2.2 `domain/entities`) — no Flutter or
/// generated-client import. Mirrors the generated `CellTower` model's shape
/// without tying callers to `CellTowerTypeEnum`'s wire identifiers.
class CellTower {
  const CellTower({
    required this.id,
    required this.lat,
    required this.lng,
    required this.type,
    required this.mcc,
    required this.mnc,
    required this.lac,
    required this.cellId,
  });

  final String id;
  final double lat;
  final double lng;
  final CellTowerType type;
  final int mcc;
  final int mnc;
  final int lac;
  final int cellId;
}

enum CellTowerType { fourG, fiveG }
