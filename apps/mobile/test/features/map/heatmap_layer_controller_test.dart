import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/domain/entities/area_stats.dart';
import 'package:mapee_mobile/features/map/heatmap_layer_controller.dart';

AreaStats _area({
  String hexId = 'hex-1',
  double centerLat = 6.5,
  double centerLng = 3.4,
  int avgLatencyMs = 40,
  int pingCount = 10,
}) {
  return AreaStats(
    hexId: hexId,
    centerLat: centerLat,
    centerLng: centerLng,
    avgLatencyMs: avgLatencyMs,
    minLatencyMs: avgLatencyMs,
    maxLatencyMs: avgLatencyMs,
    pingCount: pingCount,
    topIsp: 'MTN',
    confidenceScore: 80,
    consistency: 1,
  );
}

void main() {
  group('buildHeatmapGeoJson', () {
    test('returns a FeatureCollection with one Point feature per area', () {
      final geojson = HeatmapLayerController.buildHeatmapGeoJson([
        _area(hexId: 'a'),
        _area(hexId: 'b'),
      ]);

      expect(geojson['type'], 'FeatureCollection');
      final features = geojson['features'] as List;
      expect(features, hasLength(2));

      final first = features[0] as Map<String, dynamic>;
      expect(first['type'], 'Feature');
      expect(first['geometry'], {
        'type': 'Point',
        'coordinates': [3.4, 6.5],
      });
      expect(first['properties']['hexId'], 'a');
    });

    test('returns an empty feature list for no areas', () {
      final geojson = HeatmapLayerController.buildHeatmapGeoJson([]);
      expect(geojson['features'], isEmpty);
    });

    test('poor quality (high latency) areas get a higher weight than excellent ones', () {
      final excellent = _area(hexId: 'e', avgLatencyMs: 20, pingCount: 10);
      final poor = _area(hexId: 'p', avgLatencyMs: 500, pingCount: 10);

      final geojson = HeatmapLayerController.buildHeatmapGeoJson([excellent, poor]);
      final features = geojson['features'] as List<dynamic>;
      final weights = {
        for (final f in features)
          (f as Map<String, dynamic>)['properties']['hexId']: f['properties']['weight'] as double,
      };

      expect(weights['p']! > weights['e']!, isTrue);
    });

    test('higher ping count increases weight for areas with the same quality tier', () {
      final fewPings = _area(hexId: 'few', avgLatencyMs: 40, pingCount: 1);
      final manyPings = _area(hexId: 'many', avgLatencyMs: 40, pingCount: 100);

      final geojson = HeatmapLayerController.buildHeatmapGeoJson([fewPings, manyPings]);
      final features = geojson['features'] as List<dynamic>;
      final weights = {
        for (final f in features)
          (f as Map<String, dynamic>)['properties']['hexId']: f['properties']['weight'] as double,
      };

      expect(weights['many']! > weights['few']!, isTrue);
    });

    test('ping count contribution is clamped so extreme counts do not dominate the weight', () {
      final atCap = _area(hexId: 'cap', avgLatencyMs: 40, pingCount: 50);
      final wayOverCap = _area(hexId: 'over', avgLatencyMs: 40, pingCount: 5000);

      final geojson = HeatmapLayerController.buildHeatmapGeoJson([atCap, wayOverCap]);
      final features = geojson['features'] as List<dynamic>;
      final weights = {
        for (final f in features)
          (f as Map<String, dynamic>)['properties']['hexId']: f['properties']['weight'] as double,
      };

      expect(weights['cap'], weights['over']);
    });

    test('weight stays within the expected [0, 1] range', () {
      final best = _area(avgLatencyMs: 10, pingCount: 0);
      final worst = _area(avgLatencyMs: 1000, pingCount: 1000);

      for (final area in [best, worst]) {
        final geojson = HeatmapLayerController.buildHeatmapGeoJson([area]);
        final weight =
            (geojson['features'] as List)[0]['properties']['weight'] as double;
        expect(weight, inInclusiveRange(0.0, 1.0));
      }
    });
  });
}
