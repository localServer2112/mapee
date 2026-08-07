import 'package:flutter/cupertino.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../data/preferences/onboarding_preferences.dart';
import '../../design/haptics/haptics.dart';
import '../../design/motion/motion.dart';
import '../../design/primitives/mapee_button.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import 'onboarding_page.dart';

typedef LocationPermissionRequester = Future<PermissionStatus> Function();
typedef AppSettingsOpener = Future<bool> Function();

Future<PermissionStatus> _defaultRequestLocationPermission() =>
    Permission.locationWhenInUse.request();

Future<bool> _defaultOpenAppSettings() => openAppSettings();

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({
    super.key,
    this.onComplete,
    OnboardingPreferences? preferences,
    LocationPermissionRequester? requestLocationPermission,
    AppSettingsOpener? openAppSettings,
  })  : preferences = preferences ?? const OnboardingPreferences(),
        requestLocationPermission =
            requestLocationPermission ?? _defaultRequestLocationPermission,
        openAppSettings = openAppSettings ?? _defaultOpenAppSettings;

  final VoidCallback? onComplete;
  final OnboardingPreferences preferences;
  final LocationPermissionRequester requestLocationPermission;
  final AppSettingsOpener openAppSettings;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  static const _explainerPageCount = 3;
  static const _totalPageCount = 4;

  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _goToPage(int page) {
    final duration = MapeeMotion.duration(context, const Duration(milliseconds: 300));
    if (duration == Duration.zero) {
      _controller.jumpToPage(page);
    } else {
      _controller.animateToPage(page, duration: duration, curve: Curves.easeInOut);
    }
  }

  void _onPageChanged(int page) {
    MapeeHaptics.selectionClick();
    setState(() => _page = page);
  }

  void _onNext() {
    if (_page < _totalPageCount - 1) _goToPage(_page + 1);
  }

  void _onSkip() => _goToPage(_explainerPageCount);

  Future<void> _finish() async {
    await widget.preferences.setCompletedOnboarding(true);
    widget.onComplete?.call();
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return CupertinoPageScaffold(
      backgroundColor: colors.systemBackground,
      child: Stack(
        children: [
          PageView(
            controller: _controller,
            onPageChanged: _onPageChanged,
            children: [
              const OnboardingPage(
                icon: CupertinoIcons.antenna_radiowaves_left_right,
                title: 'Map real network quality',
                body: 'Mapee is a crowdsourced map of network conditions across '
                    'Nigeria, built entirely from tests run by people like you — '
                    'so others can see what to expect before they pick an ISP.',
              ),
              const OnboardingPage(
                icon: CupertinoIcons.speedometer,
                title: 'Run a quick test',
                body: 'Run a short network test right from your phone. Your '
                    'result — latency, speed, and your ISP — is added to a live '
                    'map that everyone can see.',
              ),
              const OnboardingPage(
                icon: CupertinoIcons.lock_shield,
                title: 'Your privacy, protected',
                body: 'Your exact location is never shown publicly. Mapee only '
                    'ever shares an approximate area, about 500 metres wide, so '
                    'your test helps map network quality without revealing '
                    'exactly where you are.',
              ),
              _PermissionPrimingPage(
                requestLocationPermission: widget.requestLocationPermission,
                openAppSettings: widget.openAppSettings,
                onFinished: _finish,
              ),
            ],
          ),
          if (_page < _explainerPageCount)
            Positioned(
              top: 0,
              right: 0,
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.only(top: MapeeSpacing.sm, right: MapeeSpacing.sm),
                  child: CupertinoButton(
                    padding: const EdgeInsets.symmetric(
                      horizontal: MapeeSpacing.md,
                      vertical: MapeeSpacing.sm,
                    ),
                    onPressed: _onSkip,
                    child: Text(
                      'Skip',
                      style: MapeeTypography.body.copyWith(color: colors.secondaryLabel),
                    ),
                  ),
                ),
              ),
            ),
          if (_page < _explainerPageCount)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: MapeeSpacing.lg,
                    vertical: MapeeSpacing.md,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _PageIndicator(
                        count: _explainerPageCount,
                        currentPage: _page,
                        onTap: _goToPage,
                      ),
                      const SizedBox(height: MapeeSpacing.md),
                      MapeeButton(
                        label: _page == _explainerPageCount - 1 ? 'Get Started' : 'Next',
                        onPressed: _onNext,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PageIndicator extends StatelessWidget {
  const _PageIndicator({
    required this.count,
    required this.currentPage,
    required this.onTap,
  });

  final int count;
  final int currentPage;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (i) {
        final active = i == currentPage;
        return GestureDetector(
          onTap: () => onTap(i),
          child: SizedBox(
            width: MapeeSpacing.minHitTarget,
            height: MapeeSpacing.minHitTarget,
            child: Center(
              child: AnimatedContainer(
                duration: MapeeMotion.duration(context, const Duration(milliseconds: 200)),
                width: active ? MapeeSpacing.md : MapeeSpacing.sm,
                height: MapeeSpacing.sm,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(MapeeSpacing.sm / 2),
                  color: active ? colors.accent : colors.separator,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}

enum _PrimingStatus { initial, requesting, granted, denied, permanentlyDenied }

class _PermissionPrimingPage extends StatefulWidget {
  const _PermissionPrimingPage({
    required this.requestLocationPermission,
    required this.openAppSettings,
    required this.onFinished,
  });

  final LocationPermissionRequester requestLocationPermission;
  final AppSettingsOpener openAppSettings;
  final VoidCallback onFinished;

  @override
  State<_PermissionPrimingPage> createState() => _PermissionPrimingPageState();
}

class _PermissionPrimingPageState extends State<_PermissionPrimingPage> {
  _PrimingStatus _status = _PrimingStatus.initial;

  Future<void> _requestPermission() async {
    setState(() => _status = _PrimingStatus.requesting);
    final result = await widget.requestLocationPermission();
    if (!mounted) return;
    if (result.isGranted || result.isLimited) {
      MapeeHaptics.success();
      setState(() => _status = _PrimingStatus.granted);
    } else if (result.isPermanentlyDenied) {
      setState(() => _status = _PrimingStatus.permanentlyDenied);
    } else {
      MapeeHaptics.warning();
      setState(() => _status = _PrimingStatus.denied);
    }
  }

  Future<void> _openSettings() => widget.openAppSettings();

  String get _bodyCopy {
    switch (_status) {
      case _PrimingStatus.granted:
        return 'Thanks — Mapee can now map network quality where you are.';
      case _PrimingStatus.denied:
        return "Without location access, Mapee can't place your test results "
            'on the map. You can turn this on later from Settings.';
      case _PrimingStatus.permanentlyDenied:
        return 'Location access is turned off for Mapee. Enable it in '
            'Settings so your test results can be added to the map.';
      case _PrimingStatus.initial:
      case _PrimingStatus.requesting:
        return 'Mapee needs your location to map network quality where you '
            'are. Your exact location is never shown publicly — only an '
            'approximate area is ever shared.';
    }
  }

  List<Widget> _actions() {
    switch (_status) {
      case _PrimingStatus.initial:
        return [MapeeButton(label: 'Allow Location Access', onPressed: _requestPermission)];
      case _PrimingStatus.requesting:
        return const [CupertinoActivityIndicator(radius: 14)];
      case _PrimingStatus.granted:
        return [MapeeButton(label: 'Get Started', onPressed: widget.onFinished)];
      case _PrimingStatus.denied:
        return [
          MapeeButton(label: 'Try Again', onPressed: _requestPermission),
          const SizedBox(height: MapeeSpacing.sm),
          MapeeButton(
            label: 'Continue Without Location',
            variant: MapeeButtonVariant.secondary,
            onPressed: widget.onFinished,
          ),
        ];
      case _PrimingStatus.permanentlyDenied:
        return [
          MapeeButton(label: 'Open Settings', onPressed: _openSettings),
          const SizedBox(height: MapeeSpacing.sm),
          MapeeButton(
            label: 'Continue Without Location',
            variant: MapeeButtonVariant.secondary,
            onPressed: widget.onFinished,
          ),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.lg, vertical: MapeeSpacing.xl),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height * 0.6),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(CupertinoIcons.location_solid, size: 88, color: colors.accent),
              const SizedBox(height: MapeeSpacing.xl),
              Text(
                'Enable Location Access',
                textAlign: TextAlign.center,
                style: MapeeTypography.title2.copyWith(color: colors.label),
              ),
              const SizedBox(height: MapeeSpacing.md),
              Text(
                _bodyCopy,
                textAlign: TextAlign.center,
                style: MapeeTypography.body.copyWith(color: colors.secondaryLabel),
              ),
              const SizedBox(height: MapeeSpacing.xl),
              ..._actions(),
            ],
          ),
        ),
      ),
    );
  }
}
