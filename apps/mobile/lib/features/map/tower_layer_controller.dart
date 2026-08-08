import 'package:flutter/cupertino.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../design/tokens/colors.dart';
import '../../domain/entities/cell_tower.dart';

/// Analogous to `map_screen.dart`'s own circle logic, but kept separate so a
/// later heatmap/area layer can coexist on the same `MapLibreMapController`
/// without one layer's `clearCircles()` wiping another's annotations.
class TowerLayerController {
  TowerLayerController(this._controller) {
    _controller.onCircleTapped.add(_handleCircleTapped);
  }

  final MapLibreMapController _controller;

  void Function(CellTower)? onTowerTapped;

  List<Circle> _circles = const [];
  List<Line> _legs = const [];
  final Map<String, CellTower> _towersById = {};

  /// "Spider legs" here means the classic marker-spiderfying technique: short
  /// lines radiating out from a shared anchor (the viewport center) to each
  /// individual tower, so a cluster of nearly-overlapping tower markers
  /// visually separates from a single dot — distinguishing the tower layer
  /// from the round, unconnected ping/area circles on the same map.
  static List<LineOptions> buildSpiderLegOptions(List<CellTower> towers, LatLng anchor) {
    final colorHex = _hexFor(MapeeColors.light.secondaryLabel);
    return towers
        .map(
          (tower) => LineOptions(
            geometry: [anchor, LatLng(tower.lat, tower.lng)],
            lineColor: colorHex,
            lineWidth: 1,
            lineOpacity: 0.5,
          ),
        )
        .toList();
  }

  static List<CircleOptions> buildTowerCircleOptions(List<CellTower> towers) {
    final colorHex = _hexFor(MapeeColors.light.secondaryLabel);
    return towers
        .map(
          (tower) => CircleOptions(
            geometry: LatLng(tower.lat, tower.lng),
            circleRadius: tower.type == CellTowerType.fiveG ? 5 : 4,
            circleColor: colorHex,
            circleOpacity: 0.9,
            circleStrokeWidth: 1,
            circleStrokeColor: '#FFFFFF',
          ),
        )
        .toList();
  }

  static String _hexFor(Color color) =>
      '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

  Future<void> showTowers(List<CellTower> towers) async {
    await hideTowers();
    if (towers.isEmpty) return;

    final bounds = await _controller.getVisibleRegion();
    final anchor = LatLng(
      (bounds.southwest.latitude + bounds.northeast.latitude) / 2,
      (bounds.southwest.longitude + bounds.northeast.longitude) / 2,
    );

    final circleOptions = buildTowerCircleOptions(towers);
    final legOptions = buildSpiderLegOptions(towers, anchor);

    final circles = <Circle>[];
    for (var i = 0; i < towers.length; i++) {
      final tower = towers[i];
      circles.add(await _controller.addCircle(circleOptions[i], {'towerId': tower.id}));
      _towersById[tower.id] = tower;
    }

    final legs = <Line>[];
    for (final options in legOptions) {
      legs.add(await _controller.addLine(options));
    }

    _circles = circles;
    _legs = legs;
  }

  Future<void> hideTowers() async {
    if (_circles.isNotEmpty) await _controller.removeCircles(_circles);
    if (_legs.isNotEmpty) await _controller.removeLines(_legs);
    _circles = const [];
    _legs = const [];
    _towersById.clear();
  }

  void _handleCircleTapped(Circle circle) {
    final towerId = circle.data?['towerId'] as String?;
    if (towerId == null) return;
    final tower = _towersById[towerId];
    if (tower == null) return;
    onTowerTapped?.call(tower);
  }
}
