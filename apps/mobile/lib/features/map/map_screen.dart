import 'dart:async';
import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../app/providers.dart';
import '../../data/repositories/tower_repository.dart';
import '../../design/primitives/mapee_metric_cell.dart';
import '../../design/primitives/mapee_sheet.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/map_styles.dart';
import '../../design/tokens/spacing.dart';
import '../../domain/entities/area_stats.dart';
import '../../domain/entities/cell_tower.dart';
import '../../domain/entities/location_fix.dart';
import '../../services/location/location_waterfall_service.dart';
import '../scan/scan_flow_screen.dart';
import '../settings/settings_screen.dart';
import 'area_sheet.dart';
import 'heatmap_layer_controller.dart';
import 'layers_sheet.dart';
import 'search_pill.dart';
import 'tower_layer_controller.dart';

/// The vertical slice from the plan's "Suggested first commits", now with
/// Phase 1/2 additions layered on: search, a labelled layers sheet (plan
/// §3's replacement for the legacy app's two icon-only toggles), a cell
/// tower layer, and a native heatmap layer.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key, this.locationService});

  /// Injectable for tests; a real instance is lazily constructed otherwise
  /// (kept out of the constructor so this stays `const`-constructible).
  final LocationWaterfallService? locationService;

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  MapLibreMapController? _controller;
  TowerLayerController? _towerLayer;
  HeatmapLayerController? _heatmapLayer;

  final Map<String, AreaStats> _areasByHexId = {};
  List<AreaStats> _lastAreas = const [];
  bool _showTowers = false;
  bool _showHeatmap = false;
  LocationFix? _pendingUserFix;

  bool _loading = false;
  String? _error;

  static const _lagosCenter = CameraPosition(target: LatLng(6.5244, 3.3792), zoom: 11);

  @override
  void initState() {
    super.initState();
    // Started here rather than from onMapCreated so the location fetch runs
    // in parallel with the map's own platform-view setup instead of after
    // it, and so this widget's State (created once per app session, since
    // it survives tab switches) is what guarantees this only happens once
    // -- not a separate flag. initState() also runs under `flutter test`
    // without a real platform view existing, unlike onMapCreated, which
    // never fires there at all.
    unawaited(_centerOnUserLocation());
  }

  void _onMapCreated(MapLibreMapController controller) {
    _controller = controller;
    controller.onCircleTapped.add(_onCircleTapped);
    _towerLayer = TowerLayerController(controller)..onTowerTapped = _onTowerTapped;
    _heatmapLayer = HeatmapLayerController(controller);

    final pendingFix = _pendingUserFix;
    if (pendingFix != null) {
      _pendingUserFix = null;
      unawaited(_moveToUserFix(pendingFix));
    }
  }

  // Permission was already decided during onboarding, so this never
  // triggers a system prompt; if it's denied or the device can't get a fix,
  // the map just stays on the Lagos default rather than guessing.
  Future<void> _centerOnUserLocation() async {
    final locationService = widget.locationService ?? LocationWaterfallService();
    final fix = await locationService.getCurrentLocation();
    if (!mounted || !fix.isAvailable) return;

    if (_controller == null) {
      _pendingUserFix = fix;
      return;
    }
    await _moveToUserFix(fix);
  }

  Future<void> _moveToUserFix(LocationFix fix) {
    return _controller!.animateCamera(
      CameraUpdate.newCameraPosition(CameraPosition(target: LatLng(fix.lat, fix.lng), zoom: 14)),
    );
  }

  Future<void> _onStyleLoaded() => _onCameraIdle();

  void _onCircleTapped(Circle circle) {
    final hexId = circle.data?['hexId'] as String?;
    final area = hexId != null ? _areasByHexId[hexId] : null;
    if (area == null) return;
    showAreaSheet(context, area);
  }

  void _onTowerTapped(CellTower tower) {
    MapeeSheet.show(
      context: context,
      builder: (context) => Row(
        children: [
          Expanded(child: MapeeMetricCell(value: tower.type.name, label: 'Type')),
          Expanded(child: MapeeMetricCell(value: '${tower.mcc}-${tower.mnc}', label: 'MCC-MNC')),
          Expanded(child: MapeeMetricCell(value: '${tower.lac}', label: 'LAC')),
        ],
      ),
    );
  }

  Future<void> _onCameraIdle() async {
    await _fetchVisibleAreas();
    if (_showTowers) await _fetchTowers();
  }

  Future<String> _currentBbox(MapLibreMapController controller) async {
    final bounds = await controller.getVisibleRegion();
    return '${bounds.southwest.latitude},${bounds.southwest.longitude},'
        '${bounds.northeast.latitude},${bounds.northeast.longitude}';
  }

  Future<void> _fetchVisibleAreas() async {
    final controller = _controller;
    if (controller == null) return;

    final bbox = await _currentBbox(controller);

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final areas = await ref.read(areaRepositoryProvider).fetchAreas(bbox);
      if (!mounted) return;

      _lastAreas = areas;
      await controller.clearCircles();
      _areasByHexId.clear();
      for (final area in areas) {
        _areasByHexId[area.hexId] = area;
        await controller.addCircle(
          CircleOptions(
            geometry: LatLng(area.centerLat, area.centerLng),
            circleRadius: 10 + (area.pingCount.clamp(0, 20) * 0.5),
            circleColor: _hexFor(area.quality),
            circleOpacity: 0.75,
            circleStrokeWidth: 1.5,
            circleStrokeColor: '#FFFFFF',
          ),
          {'hexId': area.hexId},
        );
      }
      if (_showHeatmap) await _heatmapLayer?.update(areas);
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load map data. Is apps/api running?';
      });
    }
  }

  Future<void> _fetchTowers() async {
    final controller = _controller;
    final towerLayer = _towerLayer;
    if (controller == null || towerLayer == null) return;

    final bbox = await _currentBbox(controller);
    final towers = await ref.read(towerRepositoryProvider).fetchTowers(bbox);
    if (!mounted) return;
    await towerLayer.showTowers(towers);
  }

  Future<void> _toggleTowers(bool value) async {
    setState(() => _showTowers = value);
    if (value) {
      await _fetchTowers();
    } else {
      await _towerLayer?.hideTowers();
    }
  }

  Future<void> _toggleHeatmap(bool value) async {
    setState(() => _showHeatmap = value);
    if (value) {
      // Added after the fact, heatmap renders above existing area circles --
      // redraw them so the heatmap sits underneath, matching the plan's
      // depth rule. See heatmap_layer_controller.dart's integration note:
      // maplibre_gl 0.26.2 doesn't expose the annotation layer's own id, so
      // there's no `belowLayerId` to target directly.
      await _heatmapLayer?.show(_lastAreas);
      await _fetchVisibleAreas();
    } else {
      await _heatmapLayer?.hide();
    }
  }

  void _onLocationSelected(double lat, double lng, String displayName) {
    _controller?.animateCamera(
      CameraUpdate.newCameraPosition(CameraPosition(target: LatLng(lat, lng), zoom: 14)),
    );
  }

  void _openLayersSheet() {
    showLayersSheet(
      context,
      showTowers: _showTowers,
      showHeatmap: _showHeatmap,
      onTowersChanged: _toggleTowers,
      onHeatmapChanged: _toggleHeatmap,
    );
  }

  void _openSettings() {
    Navigator.of(context).push(
      CupertinoPageRoute(builder: (context) => const SettingsScreen()),
    );
  }

  void _openScanFlow() {
    showScanFlow(context);
  }

  String _hexFor(AreaQuality quality) {
    final colors = MapeeColors.light;
    final color = switch (quality) {
      AreaQuality.excellent => colors.qualityExcellent,
      AreaQuality.good => colors.qualityGood,
      AreaQuality.fair => colors.qualityFair,
      AreaQuality.usable => colors.qualityUsable,
      AreaQuality.poor => colors.qualityPoor,
      AreaQuality.unknown => colors.qualityUnknown,
    };
    return '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final brightness = MediaQuery.platformBrightnessOf(context);
    final style = brightness == Brightness.dark ? MapeeMapStyles.dark : MapeeMapStyles.light;

    return Stack(
      children: [
        MapLibreMap(
          styleString: jsonEncode(style),
          initialCameraPosition: _lagosCenter,
          onMapCreated: _onMapCreated,
          onStyleLoadedCallback: _onStyleLoaded,
          onCameraIdle: _onCameraIdle,
        ),
        Positioned(
          top: 0,
          left: MapeeSpacing.screenMargin,
          right: MapeeSpacing.screenMargin,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.only(top: MapeeSpacing.sm),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: SearchPill(onLocationSelected: _onLocationSelected)),
                  const SizedBox(width: MapeeSpacing.sm),
                  _IconButton(icon: CupertinoIcons.square_stack_3d_up, onPressed: _openLayersSheet),
                  const SizedBox(width: MapeeSpacing.sm),
                  _IconButton(icon: CupertinoIcons.gear, onPressed: _openSettings),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          right: MapeeSpacing.screenMargin,
          bottom: MapeeSpacing.xl,
          child: SafeArea(
            top: false,
            child: _ScanFab(onPressed: _openScanFlow),
          ),
        ),
        if (_loading)
          Positioned(
            top: MapeeSpacing.minHitTarget + 60,
            right: 16,
            child: const CupertinoActivityIndicator(),
          ),
        if (_error != null)
          Positioned(
            left: 16,
            right: 16,
            bottom: 32,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: CupertinoColors.systemRed.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: CupertinoColors.white),
              ),
            ),
          ),
      ],
    );
  }
}

class _ScanFab extends StatelessWidget {
  const _ScanFab({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: colors.accent,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: CupertinoColors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: onPressed,
        child: const Icon(CupertinoIcons.dot_radiowaves_left_right, color: CupertinoColors.white, size: 28),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  const _IconButton({required this.icon, required this.onPressed});

  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Container(
      width: MapeeSpacing.minHitTarget,
      height: MapeeSpacing.minHitTarget,
      decoration: BoxDecoration(
        color: colors.secondaryBackground,
        shape: BoxShape.circle,
        border: Border.all(color: colors.separator),
        boxShadow: [
          BoxShadow(
            color: CupertinoColors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: onPressed,
        child: Icon(icon, color: colors.label),
      ),
    );
  }
}
