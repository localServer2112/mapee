import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/domain/entities/cell_tower.dart';
import 'package:mapee_mobile/features/map/tower_layer_controller.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

void main() {
  const towers = [
    CellTower(
      id: '621-20-1-1',
      lat: 6.5244,
      lng: 3.3792,
      type: CellTowerType.fourG,
      mcc: 621,
      mnc: 20,
      lac: 1,
      cellId: 1,
    ),
    CellTower(
      id: '621-30-2-2',
      lat: 6.4698,
      lng: 3.5852,
      type: CellTowerType.fiveG,
      mcc: 621,
      mnc: 30,
      lac: 2,
      cellId: 2,
    ),
  ];

  group('buildTowerCircleOptions', () {
    test('produces one circle per tower at the tower\'s coordinates', () {
      final options = TowerLayerController.buildTowerCircleOptions(towers);

      expect(options, hasLength(2));
      expect(options[0].geometry, const LatLng(6.5244, 3.3792));
      expect(options[1].geometry, const LatLng(6.4698, 3.5852));
    });

    test('gives 5G towers a larger radius than 4G towers', () {
      final options = TowerLayerController.buildTowerCircleOptions(towers);

      expect(options[1].circleRadius, greaterThan(options[0].circleRadius!));
    });

    test('colors every circle the same, non-null hex', () {
      final options = TowerLayerController.buildTowerCircleOptions(towers);

      expect(options[0].circleColor, isNotNull);
      expect(options[0].circleColor, startsWith('#'));
      expect(options[0].circleColor, options[1].circleColor);
    });

    test('returns an empty list for no towers', () {
      expect(TowerLayerController.buildTowerCircleOptions(const []), isEmpty);
    });
  });

  group('buildSpiderLegOptions', () {
    const anchor = LatLng(6.5, 3.45);

    test('produces one line per tower, each running from the anchor to the tower', () {
      final options = TowerLayerController.buildSpiderLegOptions(towers, anchor);

      expect(options, hasLength(2));
      expect(options[0].geometry, [anchor, const LatLng(6.5244, 3.3792)]);
      expect(options[1].geometry, [anchor, const LatLng(6.4698, 3.5852)]);
    });

    test('returns an empty list for no towers', () {
      expect(TowerLayerController.buildSpiderLegOptions(const [], anchor), isEmpty);
    });
  });
}
