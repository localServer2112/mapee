import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/domain/entities/cell_tower.dart';
import 'package:mapee_mobile/domain/towers.dart';

CellTower tower({
  String id = '621-30-1-1',
  double lat = 6.5244,
  double lng = 3.3792,
  CellTowerType type = CellTowerType.fourG,
  int mcc = 621,
  int mnc = 30,
  int lac = 1,
  int cellId = 1,
}) {
  return CellTower(id: id, lat: lat, lng: lng, type: type, mcc: mcc, mnc: mnc, lac: lac, cellId: cellId);
}

void main() {
  group('calculateDistance', () {
    test('is zero for identical points', () {
      expect(calculateDistance(6.5, 3.3, 6.5, 3.3), 0);
    });

    test('matches the known length of one degree of latitude', () {
      // 1 degree of latitude is ~111.19 km on a sphere of radius 6371 km
      expect(calculateDistance(0, 0, 1, 0), closeTo(111.19, 0.1));
    });

    test('is symmetric', () {
      final ab = calculateDistance(6.5244, 3.3792, 9.0765, 7.3986);
      final ba = calculateDistance(9.0765, 7.3986, 6.5244, 3.3792);
      expect(ab, closeTo(ba, 1e-10));
    });

    test('approximates the Lagos-Abuja great-circle distance', () {
      final km = calculateDistance(6.5244, 3.3792, 9.0765, 7.3986);
      expect(km, greaterThan(520));
      expect(km, lessThan(540));
    });
  });

  group('findNearestTowers', () {
    test('returns empty when there are no towers', () {
      expect(findNearestTowers(6.5, 3.3, []), <CellTower>[]);
    });

    test('returns the closest N in ascending distance order', () {
      final towers = [
        tower(id: 'far', lat: 8.0, lng: 3.3792),
        tower(id: 'near', lat: 6.53, lng: 3.3792),
        tower(id: 'mid', lat: 7.0, lng: 3.3792),
      ];
      expect(
        findNearestTowers(6.5244, 3.3792, towers, 2).map((t) => t.id).toList(),
        ['near', 'mid'],
      );
    });

    test('returns everything when asked for more than exist', () {
      expect(findNearestTowers(6.5, 3.3, [tower()], 5), hasLength(1));
    });
  });

  group('generateSpiderLegs', () {
    test('produces one origin-to-tower segment per tower', () {
      final legs = generateSpiderLegs(6.5, 3.3, [
        tower(lat: 6.6, lng: 3.4),
        tower(lat: 6.7, lng: 3.5),
      ]);
      expect(legs, [
        ((6.5, 3.3), (6.6, 3.4)),
        ((6.5, 3.3), (6.7, 3.5)),
      ]);
    });

    test('produces nothing for no towers', () {
      expect(generateSpiderLegs(6.5, 3.3, []), <((double, double), (double, double))>[]);
    });
  });

  group('filterTowersInBounds', () {
    final inside = tower(id: 'inside', lat: 6.5, lng: 3.3);
    final outside = tower(id: 'outside', lat: 9.0, lng: 7.0);

    test('keeps only towers within the box', () {
      final kept = filterTowersInBounds([inside, outside], 7, 6, 4, 3);
      expect(kept.map((t) => t.id).toList(), ['inside']);
    });

    test('treats bounds as inclusive', () {
      final onEdge = tower(id: 'edge', lat: 7, lng: 4);
      expect(filterTowersInBounds([onEdge], 7, 6, 4, 3), hasLength(1));
    });
  });

  group('groupTowersByType', () {
    test('counts both radio types, including zeroes', () {
      expect(groupTowersByType([]), {CellTowerType.fourG: 0, CellTowerType.fiveG: 0});
      expect(
        groupTowersByType([
          tower(type: CellTowerType.fourG),
          tower(type: CellTowerType.fiveG),
          tower(type: CellTowerType.fiveG),
        ]),
        {CellTowerType.fourG: 1, CellTowerType.fiveG: 2},
      );
    });
  });

  group('calculateAverageTowerDistance', () {
    test('returns 0 for no towers rather than dividing by zero', () {
      expect(calculateAverageTowerDistance(6.5, 3.3, []), 0);
    });

    test('averages the distances', () {
      final avg = calculateAverageTowerDistance(0, 0, [
        tower(lat: 1, lng: 0),
        tower(lat: 3, lng: 0),
      ]);
      expect(avg, closeTo(calculateDistance(0, 0, 2, 0), 0.1));
    });
  });
}
