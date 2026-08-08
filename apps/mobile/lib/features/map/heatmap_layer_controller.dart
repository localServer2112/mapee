import 'package:maplibre_gl/maplibre_gl.dart';

import '../../domain/entities/area_stats.dart';

class HeatmapLayerController {
  HeatmapLayerController(this._controller);

  final MapLibreMapController _controller;
  bool _sourceAdded = false;

  static const String sourceId = 'mapee-heatmap-source';
  static const String layerId = 'mapee-heatmap-layer';

  static const Map<AreaQuality, double> _qualityFactor = {
    AreaQuality.excellent: 0.1,
    AreaQuality.good: 0.3,
    AreaQuality.fair: 0.55,
    AreaQuality.usable: 0.8,
    AreaQuality.poor: 1.0,
    AreaQuality.unknown: 0.5,
  };

  // Weight blends two signals so the heatmap reads as "where is the network
  // bad and how much do we know about it": 70% comes from the area's quality
  // tier (poor latency -> factor close to 1, excellent -> close to 0.1) and
  // 30% comes from ping volume normalized against a 50-ping cap (more pings
  // -> more confidence that the reading is real, so it should stand out more
  // on the map). The 50-ping cap is a rough "well-sampled area" threshold,
  // not derived from data; revisit once real traffic volumes are known.
  static double _weightFor(AreaStats area) {
    final qualityFactor = _qualityFactor[area.quality] ?? 0.5;
    final volumeFactor = (area.pingCount / 50).clamp(0.0, 1.0);
    return (0.7 * qualityFactor) + (0.3 * volumeFactor);
  }

  static Map<String, dynamic> buildHeatmapGeoJson(List<AreaStats> areas) {
    return {
      'type': 'FeatureCollection',
      'features': [
        for (final area in areas)
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Point',
              'coordinates': [area.centerLng, area.centerLat],
            },
            'properties': {
              'hexId': area.hexId,
              'weight': _weightFor(area),
            },
          },
      ],
    };
  }

  Future<void> show(List<AreaStats> areas, {String? belowLayerId}) async {
    final geojson = buildHeatmapGeoJson(areas);
    if (_sourceAdded) {
      await _controller.setGeoJsonSource(sourceId, geojson);
      return;
    }

    await _controller.addGeoJsonSource(sourceId, geojson);
    _sourceAdded = true;
    await _controller.addLayer(
      sourceId,
      layerId,
      const HeatmapLayerProperties(
        heatmapRadius: [
          Expressions.interpolate,
          ['linear'],
          [Expressions.zoom],
          0,
          2,
          9,
          20,
        ],
        heatmapWeight: [Expressions.get, 'weight'],
        heatmapIntensity: [
          Expressions.interpolate,
          ['linear'],
          [Expressions.zoom],
          0,
          1,
          9,
          3,
        ],
        heatmapColor: [
          Expressions.interpolate,
          ['linear'],
          [Expressions.heatmapDensity],
          0,
          'rgba(0, 0, 255, 0)',
          0.2,
          'royalblue',
          0.4,
          'cyan',
          0.6,
          'lime',
          0.8,
          'yellow',
          1,
          'red',
        ],
        heatmapOpacity: 0.75,
      ),
      belowLayerId: belowLayerId,
    );
  }

  Future<void> update(List<AreaStats> areas) async {
    if (!_sourceAdded) {
      await show(areas);
      return;
    }
    await _controller.setGeoJsonSource(sourceId, buildHeatmapGeoJson(areas));
  }

  Future<void> hide() async {
    if (!_sourceAdded) return;
    await _controller.removeLayer(layerId);
    await _controller.removeSource(sourceId);
    _sourceAdded = false;
  }
}
