import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/tab_shell.dart';
import 'app/theme.dart';
import 'data/preferences/onboarding_preferences.dart';
import 'features/onboarding/onboarding_screen.dart';

void main() {
  runApp(const ProviderScope(child: MapeeApp()));
}

class MapeeApp extends StatelessWidget {
  const MapeeApp({super.key});

  @override
  Widget build(BuildContext context) {
    final brightness = MediaQuery.platformBrightnessOf(context);
    return CupertinoApp(
      title: 'Mapee',
      theme: cupertinoThemeFor(brightness),
      home: const _StartupGate(),
    );
  }
}

/// Routes to onboarding on first launch, else straight to the tab shell.
class _StartupGate extends StatefulWidget {
  const _StartupGate();

  @override
  State<_StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<_StartupGate> {
  final _preferences = const OnboardingPreferences();
  bool? _hasCompletedOnboarding;

  @override
  void initState() {
    super.initState();
    _preferences.hasCompletedOnboarding.then((completed) {
      if (!mounted) return;
      setState(() => _hasCompletedOnboarding = completed);
    });
  }

  void _onOnboardingComplete() {
    setState(() => _hasCompletedOnboarding = true);
  }

  @override
  Widget build(BuildContext context) {
    final completed = _hasCompletedOnboarding;
    if (completed == null) {
      return const CupertinoPageScaffold(child: Center(child: CupertinoActivityIndicator()));
    }
    if (!completed) {
      return OnboardingScreen(onComplete: _onOnboardingComplete);
    }
    return const TabShell();
  }
}
