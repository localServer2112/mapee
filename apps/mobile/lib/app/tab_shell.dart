import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/haptics/haptics.dart';
import '../design/motion/motion.dart';
import '../design/tokens/colors.dart';
import '../design/tokens/spacing.dart';
import '../features/insights/insights_screen.dart';
import '../features/map/map_screen.dart';
import '../features/report/activity_screen.dart';
import '../services/connectivity/connectivity_service.dart';

/// Three tabs (plan §3): Map, Activity, Insights. Replaces the current
/// single page with modals stacked on it — native gets real navigation.
class TabShell extends ConsumerStatefulWidget {
  const TabShell({super.key});

  @override
  ConsumerState<TabShell> createState() => _TabShellState();
}

class _TabShellState extends ConsumerState<TabShell> {
  bool? _online;
  StreamSubscription<bool>? _subscription;

  @override
  void initState() {
    super.initState();
    final service = ref.read(connectivityServiceProvider);
    service.isOnlineNow.then((online) {
      if (!mounted || _online != null) return;
      setState(() => _online = online);
    });
    _subscription = service.onlineStatus.listen(_onStatusChanged);
  }

  void _onStatusChanged(bool online) {
    // Fire the offline haptic only on a genuine online->offline transition —
    // not on every stream emission, and not on cold start when the device
    // is already offline (there's no prior online state to transition from).
    if (_online == true && online == false) {
      MapeeHaptics.warning();
    }
    if (online != _online) {
      setState(() => _online = online);
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final showBanner = _online == false;
    return Column(
      children: [
        AnimatedSize(
          duration: MapeeMotion.duration(context, const Duration(milliseconds: 250)),
          alignment: Alignment.topCenter,
          child: showBanner ? const _OfflineBanner() : const SizedBox(width: double.infinity),
        ),
        Expanded(
          child: CupertinoTabScaffold(
            tabBar: CupertinoTabBar(
              items: const [
                BottomNavigationBarItem(icon: Icon(CupertinoIcons.map), label: 'Map'),
                BottomNavigationBarItem(icon: Icon(CupertinoIcons.time), label: 'Activity'),
                BottomNavigationBarItem(icon: Icon(CupertinoIcons.chart_bar), label: 'Insights'),
              ],
            ),
            tabBuilder: (context, index) {
              final page = switch (index) {
                0 => const MapScreen(),
                1 => const ActivityScreen(),
                _ => const InsightsScreen(),
              };
              return CupertinoTabView(builder: (context) => page);
            },
          ),
        ),
      ],
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return SafeArea(
      bottom: false,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.md, vertical: MapeeSpacing.sm),
        color: colors.qualityPoor,
        child: const Text(
          "You're offline — some features may not work.",
          textAlign: TextAlign.center,
          style: TextStyle(color: CupertinoColors.white),
        ),
      ),
    );
  }
}
