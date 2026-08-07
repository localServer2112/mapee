import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../app/providers.dart';
import '../../data/preferences/settings_preferences.dart';
import '../../data/repositories/install_repository.dart';
import '../../design/haptics/haptics.dart';
import '../../design/primitives/mapee_row.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _preferences = const SettingsPreferences();

  bool _loading = true;
  bool _deleting = false;
  DistanceUnits _units = DistanceUnits.metric;
  bool _dataSaverEnabled = false;
  PackageInfo? _packageInfo;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final units = await _preferences.units;
    final dataSaverEnabled = await _preferences.dataSaverEnabled;
    final packageInfo = await PackageInfo.fromPlatform();
    if (!mounted) return;
    setState(() {
      _units = units;
      _dataSaverEnabled = dataSaverEnabled;
      _packageInfo = packageInfo;
      _loading = false;
    });
  }

  Future<void> _setImperial(bool imperial) async {
    MapeeHaptics.selectionClick();
    final next = imperial ? DistanceUnits.imperial : DistanceUnits.metric;
    setState(() => _units = next);
    await _preferences.setUnits(next);
  }

  Future<void> _setDataSaver(bool value) async {
    MapeeHaptics.selectionClick();
    setState(() => _dataSaverEnabled = value);
    await _preferences.setDataSaverEnabled(value);
  }

  Future<void> _confirmDeleteMyData() async {
    MapeeHaptics.selectionClick();
    final confirmed = await showCupertinoDialog<bool>(
      context: context,
      builder: (dialogContext) => CupertinoAlertDialog(
        title: const Text('Delete my data?'),
        content: const Text(
          "This would permanently delete every scan you've contributed to Mapee and stop associating your "
          'device with future ones. This cannot be undone.',
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _deleting = true);
    final outcome = await _deleteMyData();
    if (!mounted) return;
    setState(() => _deleting = false);

    await showCupertinoDialog<void>(
      context: context,
      builder: (dialogContext) => CupertinoAlertDialog(
        title: Text(outcome.title),
        content: Text(outcome.message),
        actions: [
          CupertinoDialogAction(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<({String title, String message})> _deleteMyData() async {
    try {
      final token = await ref.read(installRepositoryProvider).ensureInstall();
      final response = await ref.read(apiClientProvider).installs.v1MeScansDelete(
            authorization: 'Bearer $token',
          );
      final deletedCount = response.data?.deletedCount;

      if (deletedCount == null) {
        return (
          title: "Couldn't delete your data",
          message: "Couldn't delete your data right now. Check your connection and try again.",
        );
      }
      if (deletedCount == 0) {
        return (title: 'Nothing to delete', message: "You don't have any scans to delete.");
      }
      return (
        title: 'Deleted',
        message: deletedCount == 1 ? 'Deleted 1 scan.' : 'Deleted $deletedCount scans.',
      );
    } on DioException {
      return (
        title: "Couldn't delete your data",
        message: "Couldn't delete your data right now. Check your connection and try again.",
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);

    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('Settings')),
      child: _loading
          ? const Center(child: CupertinoActivityIndicator())
          : SafeArea(
              child: ListView(
                children: [
                  const SizedBox(height: MapeeSpacing.md),
                  _SectionHeader('Units', colors: colors),
                  MapeeRow(
                    title: 'Imperial units',
                    subtitle: 'Show distances in miles instead of kilometres',
                    trailing: CupertinoSwitch(
                      value: _units == DistanceUnits.imperial,
                      onChanged: _setImperial,
                    ),
                  ),
                  const SizedBox(height: MapeeSpacing.lg),
                  _SectionHeader('Data', colors: colors),
                  MapeeRow(
                    title: 'Data saver',
                    subtitle: 'Reduce data usage during scans',
                    trailing: CupertinoSwitch(
                      value: _dataSaverEnabled,
                      onChanged: _setDataSaver,
                    ),
                  ),
                  const SizedBox(height: MapeeSpacing.lg),
                  _SectionHeader('Privacy', colors: colors),
                  MapeeRow(
                    title: 'Delete my data',
                    subtitle: 'Permanently remove your scans from Mapee',
                    showChevron: false,
                    trailing: _deleting
                        ? const CupertinoActivityIndicator()
                        : const Icon(CupertinoIcons.delete, color: CupertinoColors.destructiveRed),
                    onTap: _deleting ? null : _confirmDeleteMyData,
                  ),
                  const SizedBox(height: MapeeSpacing.lg),
                  _SectionHeader('About', colors: colors),
                  MapeeRow(
                    title: 'Version',
                    showChevron: false,
                    trailing: Text(
                      _packageInfo == null
                          ? '—'
                          : '${_packageInfo!.version} (${_packageInfo!.buildNumber})',
                      style: MapeeTypography.subheadline.copyWith(color: colors.secondaryLabel),
                    ),
                  ),
                  const SizedBox(height: MapeeSpacing.lg),
                ],
              ),
            ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title, {required this.colors});

  final String title;
  final MapeeColors colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(MapeeSpacing.md, 0, MapeeSpacing.md, MapeeSpacing.xs),
      child: Text(title, style: MapeeTypography.footnote.copyWith(color: colors.secondaryLabel)),
    );
  }
}
