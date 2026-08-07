import '../../app/env.dart';

/// Hand-authored MapLibre GL styles (plan §4.1) painting Mapbox's real
/// Streets v8 vector tiles, rendered through MapLibre GL (`maplibre_gl`),
/// not the Mapbox SDK.
///
/// Mapbox's own hosted styles (e.g. `mapbox://styles/mapbox/light-v11`)
/// can't be used directly here — their style documents reference their
/// vector source and sprites via the proprietary `mapbox://` URL scheme,
/// which only Mapbox's own SDK resolves; MapLibre's networking layer
/// doesn't understand it and every tile/sprite/glyph request fails with
/// "unsupported URL" (confirmed by actually loading one on a real device).
/// Fully rewriting Mapbox's production styles to plain HTTPS would also
/// mean matching ~15 source-layers' full paint/filter logic just to get
/// back to what Mapbox already ships — not worth it for a backdrop this
/// app draws heavy overlays on top of anyway.
///
/// Instead, this points a hand-authored style (in the same spirit as the
/// three-layer one this replaces) at Mapbox's Streets v8 vector *source*
/// via its plain HTTPS tile endpoint (`api.mapbox.com/v4/...`, not
/// `mapbox://...`), and paints a deliberately small subset of its real
/// source-layers — confirmed via the source's own TileJSON
/// (`vector_layers`) rather than guessed — with `MapeeColors` tokens:
/// water, land, roads, admin borders, place labels, and buildings (visible
/// once zoomed in, e.g. the scan flow's location-adjust map). No icons, so
/// no sprite sheet needed; labels need `glyphs`, which Mapbox does expose
/// over plain HTTPS.
class MapeeMapStyles {
  const MapeeMapStyles._();

  static const String _tileUrl =
      'https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${Env.mapboxAccessToken}';

  static const String _glyphsUrl =
      'https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${Env.mapboxAccessToken}';

  static Map<String, dynamic> _style({
    required String name,
    required String background,
    required String water,
    required String land,
    required String building,
    required String road,
    required String admin,
    required String labelText,
    required String labelHalo,
  }) {
    return {
      'version': 8,
      'name': name,
      'glyphs': _glyphsUrl,
      'sources': {
        'mapee': {
          'type': 'vector',
          'tiles': [_tileUrl],
          'maxzoom': 14,
        },
      },
      'layers': [
        {
          'id': 'background',
          'type': 'background',
          'paint': {'background-color': background},
        },
        {
          'id': 'land',
          'type': 'fill',
          'source': 'mapee',
          'source-layer': 'landuse',
          'paint': {'fill-color': land},
        },
        {
          'id': 'water',
          'type': 'fill',
          'source': 'mapee',
          'source-layer': 'water',
          'paint': {'fill-color': water},
        },
        {
          'id': 'building',
          'type': 'fill',
          'source': 'mapee',
          'source-layer': 'building',
          'minzoom': 15,
          'paint': {'fill-color': building, 'fill-opacity': 0.6},
        },
        {
          'id': 'road',
          'type': 'line',
          'source': 'mapee',
          'source-layer': 'road',
          'layout': {'line-cap': 'round', 'line-join': 'round'},
          'paint': {
            'line-color': road,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 2.5],
          },
        },
        {
          'id': 'admin',
          'type': 'line',
          'source': 'mapee',
          'source-layer': 'admin',
          'filter': ['<=', ['get', 'admin_level'], 2],
          'layout': {'line-cap': 'round', 'line-join': 'round'},
          'paint': {'line-color': admin, 'line-width': 1},
        },
        {
          'id': 'place-label',
          'type': 'symbol',
          'source': 'mapee',
          'source-layer': 'place_label',
          'layout': {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 12, 13],
          },
          'paint': {
            'text-color': labelText,
            'text-halo-color': labelHalo,
            'text-halo-width': 1,
          },
        },
      ],
    };
  }

  static final Map<String, dynamic> light = _style(
    name: 'Mapee Light',
    background: '#FFFFFF', // MapeeColors.light.systemBackground
    water: '#F2F2F7', // MapeeColors.light.secondaryBackground
    land: '#FAFAFC', // between systemBackground and secondaryBackground
    building: '#E5E5EA',
    road: 'rgba(198, 198, 200, 0.6)', // MapeeColors.light.separator, stronger
    admin: 'rgba(198, 198, 200, 0.9)', // MapeeColors.light.separator, opaque
    labelText: '#3C3C43', // MapeeColors.light.secondaryLabel
    labelHalo: '#FFFFFF',
  );

  static final Map<String, dynamic> dark = _style(
    name: 'Mapee Dark',
    background: '#000000', // MapeeColors.dark.systemBackground
    water: '#1C1C1E', // MapeeColors.dark.secondaryBackground
    land: '#0A0A0B',
    building: '#2C2C2E',
    road: 'rgba(56, 56, 58, 0.6)', // MapeeColors.dark.separator, stronger
    admin: 'rgba(56, 56, 58, 0.9)', // MapeeColors.dark.separator, opaque
    labelText: '#AEAEB2', // MapeeColors.dark.secondaryLabel
    labelHalo: '#000000',
  );
}
