import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../design/haptics/haptics.dart';
import '../../design/primitives/mapee_button.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/map_styles.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import '../../domain/entities/location_fix.dart';
import '../../services/location/location_waterfall_service.dart';

typedef AppSettingsOpener = Future<bool> Function();

Future<bool> _defaultOpenAppSettings() => openAppSettings();

enum _Phase { loading, preview, adjusting, unavailable }

class LocationStep extends StatefulWidget {
  LocationStep({
    super.key,
    required this.onConfirmed,
    required this.onCancel,
    LocationWaterfallService? locationService,
    AppSettingsOpener? openAppSettings,
  })  : locationService = locationService ?? LocationWaterfallService(),
        openAppSettings = openAppSettings ?? _defaultOpenAppSettings;

  final void Function(LocationFix confirmed) onConfirmed;
  final VoidCallback onCancel;
  final LocationWaterfallService locationService;
  final AppSettingsOpener openAppSettings;

  @override
  State<LocationStep> createState() => _LocationStepState();
}

class _LocationStepState extends State<LocationStep> {
  _Phase _phase = _Phase.loading;
  LocationFix? _fix;
  MapLibreMapController? _mapController;
  LatLng? _adjustedTarget;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _phase = _Phase.loading);
    final fix = await widget.locationService.getCurrentLocation();
    if (!mounted) return;
    setState(() {
      _fix = fix;
      _phase = fix.isAvailable ? _Phase.preview : _Phase.unavailable;
    });
  }

  void _onMapCreated(MapLibreMapController controller) {
    _mapController = controller;
  }

  void _confirmPreview() {
    final fix = _fix;
    if (fix == null) return;
    widget.onConfirmed(fix);
  }

  void _beginAdjust() {
    final fix = _fix;
    if (fix == null) return;
    MapeeHaptics.selectionClick();
    setState(() {
      _adjustedTarget = LatLng(fix.lat, fix.lng);
      _phase = _Phase.adjusting;
    });
  }

  void _cancelAdjust() {
    final fix = _fix;
    setState(() {
      _adjustedTarget = fix == null ? null : LatLng(fix.lat, fix.lng);
      _phase = _Phase.preview;
    });
  }

  Future<void> _onCameraIdle() async {
    final controller = _mapController;
    if (controller == null) return;
    final bounds = await controller.getVisibleRegion();
    if (!mounted) return;
    setState(() {
      _adjustedTarget = LatLng(
        (bounds.southwest.latitude + bounds.northeast.latitude) / 2,
        (bounds.southwest.longitude + bounds.northeast.longitude) / 2,
      );
    });
  }

  void _confirmAdjust() {
    final original = _fix;
    final target = _adjustedTarget;
    if (original == null || target == null) return;
    widget.onConfirmed(
      LocationFix(
        lat: target.latitude,
        lng: target.longitude,
        // A manually dropped pin has no automatic-fix accuracy figure of its
        // own; reusing the original fix's accuracyMeters as a rough proxy is
        // more honest than hardcoding 0, which would claim perfect precision
        // that was never measured.
        accuracyMeters: original.accuracyMeters,
        source: original.source,
      ),
    );
  }

  String _accuracyCaption(double accuracyMeters) {
    final rounded = accuracyMeters.round();
    if (accuracyMeters > 100) return 'Low accuracy (~${rounded}m)';
    return 'Accurate to ~${rounded}m';
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(MapeeSpacing.md),
        child: switch (_phase) {
          _Phase.loading => _LoadingView(colors: colors),
          _Phase.unavailable => _UnavailableView(
              colors: colors,
              onRetry: _load,
              onOpenSettings: widget.openAppSettings,
            ),
          _Phase.preview || _Phase.adjusting => _buildMapFlow(colors),
        },
      ),
    );
  }

  Widget _buildMapFlow(MapeeColors colors) {
    final fix = _fix!;
    final adjusting = _phase == _Phase.adjusting;
    final brightness = MediaQuery.platformBrightnessOf(context);
    final style = brightness == Brightness.dark ? MapeeMapStyles.dark : MapeeMapStyles.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          adjusting ? 'Drag the map to move the pin' : 'Your detected location',
          style: MapeeTypography.title2.copyWith(color: colors.label),
        ),
        const SizedBox(height: MapeeSpacing.sm),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(MapeeSpacing.radiusCard),
            child: Stack(
              alignment: Alignment.center,
              children: [
                MapLibreMap(
                  key: const Key('location-step-map'),
                  styleString: jsonEncode(style),
                  initialCameraPosition: CameraPosition(target: LatLng(fix.lat, fix.lng), zoom: 16),
                  onMapCreated: _onMapCreated,
                  onCameraIdle: adjusting ? _onCameraIdle : null,
                  dragEnabled: adjusting,
                  scrollGesturesEnabled: adjusting,
                  zoomGesturesEnabled: adjusting,
                  rotateGesturesEnabled: adjusting,
                  tiltGesturesEnabled: adjusting,
                  compassEnabled: false,
                  myLocationEnabled: false,
                ),
                IgnorePointer(
                  child: Icon(
                    CupertinoIcons.location_solid,
                    size: 32,
                    color: colors.accent,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: MapeeSpacing.md),
        Text(
          adjusting
              ? 'The pin marks the centre of the map.'
              : _accuracyCaption(fix.accuracyMeters),
          textAlign: TextAlign.center,
          style: MapeeTypography.footnote.copyWith(color: colors.secondaryLabel),
        ),
        const SizedBox(height: MapeeSpacing.md),
        if (adjusting) ...[
          MapeeButton(label: 'Use this location', onPressed: _confirmAdjust),
          const SizedBox(height: MapeeSpacing.sm),
          MapeeButton(
            label: 'Back',
            variant: MapeeButtonVariant.secondary,
            onPressed: _cancelAdjust,
          ),
        ] else ...[
          MapeeButton(label: 'This looks right', onPressed: _confirmPreview),
          const SizedBox(height: MapeeSpacing.sm),
          MapeeButton(
            label: 'Adjust location',
            variant: MapeeButtonVariant.secondary,
            onPressed: _beginAdjust,
          ),
        ],
      ],
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView({required this.colors});

  final MapeeColors colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(CupertinoIcons.location, size: 64, color: colors.accent),
          const SizedBox(height: MapeeSpacing.lg),
          Text(
            'Finding Your Location',
            textAlign: TextAlign.center,
            style: MapeeTypography.title2.copyWith(color: colors.label),
          ),
          const SizedBox(height: MapeeSpacing.md),
          Text(
            'Mapee needs a moment to find where you are, so this test can be '
            'placed on the map.',
            textAlign: TextAlign.center,
            style: MapeeTypography.body.copyWith(color: colors.secondaryLabel),
          ),
          const SizedBox(height: MapeeSpacing.xl),
          const CupertinoActivityIndicator(radius: 14),
        ],
      ),
    );
  }
}

class _UnavailableView extends StatelessWidget {
  const _UnavailableView({
    required this.colors,
    required this.onRetry,
    required this.onOpenSettings,
  });

  final MapeeColors colors;
  final VoidCallback onRetry;
  final AppSettingsOpener onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(CupertinoIcons.location_slash, size: 64, color: colors.secondaryLabel),
          const SizedBox(height: MapeeSpacing.lg),
          Text(
            'Location Unavailable',
            textAlign: TextAlign.center,
            style: MapeeTypography.title2.copyWith(color: colors.label),
          ),
          const SizedBox(height: MapeeSpacing.md),
          Text(
            "Mapee couldn't determine your location for this scan. If you "
            'denied location access earlier, you can turn it on in Settings.',
            textAlign: TextAlign.center,
            style: MapeeTypography.body.copyWith(color: colors.secondaryLabel),
          ),
          const SizedBox(height: MapeeSpacing.xl),
          MapeeButton(label: 'Try Again', onPressed: onRetry),
          const SizedBox(height: MapeeSpacing.sm),
          MapeeButton(
            label: 'Open Settings',
            variant: MapeeButtonVariant.secondary,
            onPressed: onOpenSettings,
          ),
        ],
      ),
    );
  }
}
