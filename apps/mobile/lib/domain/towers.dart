import 'dart:math' as math;

import 'entities/cell_tower.dart';

/// Cell Tower Utilities
///
/// Functions for working with cell tower data and calculating distances for
/// spider-leg visualizations.

/// Haversine distance between two points, in kilometers.
double calculateDistance(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371.0; // Earth's radius in kilometers
  final dLat = _toRadians(lat2 - lat1);
  final dLng = _toRadians(lng2 - lng1);

  final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_toRadians(lat1)) *
          math.cos(_toRadians(lat2)) *
          math.sin(dLng / 2) *
          math.sin(dLng / 2);

  final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  return r * c;
}

double _toRadians(double degrees) => degrees * (math.pi / 180);

List<CellTower> findNearestTowers(
  double lat,
  double lng,
  List<CellTower> towers, [
  int count = 3,
]) {
  if (towers.isEmpty) return [];

  final towersWithDistance = [
    for (final tower in towers) (tower: tower, distance: calculateDistance(lat, lng, tower.lat, tower.lng)),
  ];

  towersWithDistance.sort((a, b) => a.distance.compareTo(b.distance));

  return [for (final t in towersWithDistance.take(count)) t.tower];
}

/// Spider-leg segments: pairs of (lat, lng) points, one per tower, from the
/// center point to that tower.
List<((double, double), (double, double))> generateSpiderLegs(
  double centerLat,
  double centerLng,
  List<CellTower> towers,
) {
  return [
    for (final tower in towers) ((centerLat, centerLng), (tower.lat, tower.lng)),
  ];
}

String getTowerIcon(CellTowerType type) {
  // Lucide icon names
  return type == CellTowerType.fiveG ? 'zap' : 'antenna';
}

String towerTypeLabel(CellTowerType type) => type == CellTowerType.fiveG ? '5G' : '4G';

String formatTowerInfo(CellTower tower) {
  return '${towerTypeLabel(tower.type)} Tower (Cell ID: ${tower.cellId})';
}

List<CellTower> filterTowersInBounds(
  List<CellTower> towers,
  double north,
  double south,
  double east,
  double west,
) {
  return towers
      .where((tower) => tower.lat >= south && tower.lat <= north && tower.lng >= west && tower.lng <= east)
      .toList();
}

Map<CellTowerType, int> groupTowersByType(List<CellTower> towers) {
  final counts = {CellTowerType.fourG: 0, CellTowerType.fiveG: 0};

  for (final tower in towers) {
    counts[tower.type] = counts[tower.type]! + 1;
  }

  return counts;
}

double calculateAverageTowerDistance(double lat, double lng, List<CellTower> towers) {
  if (towers.isEmpty) return 0;

  final totalDistance = towers.fold<double>(0, (sum, tower) => sum + calculateDistance(lat, lng, tower.lat, tower.lng));

  return totalDistance / towers.length;
}
