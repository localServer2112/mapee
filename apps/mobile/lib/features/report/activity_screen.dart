import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/repositories/my_scans_repository.dart';
import '../../design/haptics/haptics.dart';
import '../../design/primitives/mapee_button.dart';
import '../../design/primitives/mapee_row.dart';
import '../../design/primitives/mapee_skeleton.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import '../../domain/entities/my_scan.dart';
import 'scan_detail_screen.dart';
import 'scan_format.dart';

typedef MyScansFetcher = Future<List<MyScan>> Function();

enum _LoadState { loading, error, loaded }

/// My-scans list (plan §10 Track B Phase 5). [fetchScans] is an optional
/// injection point — mirrors `LocationStep`'s constructor-injected-service
/// pattern — so widget tests can supply a controllable fetch function
/// directly instead of fighting Riverpod provider overrides for
/// `MyScansRepository`, whose real constructor needs a live `ApiClient` and
/// `InstallRepository`.
class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key, this.fetchScans});

  final MyScansFetcher? fetchScans;

  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  _LoadState _state = _LoadState.loading;
  List<MyScan> _scans = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _state = _LoadState.loading);
    try {
      final fetch = widget.fetchScans ?? ref.read(myScansRepositoryProvider).fetchMyScans;
      final scans = await fetch();
      if (!mounted) return;
      setState(() {
        _scans = scans;
        _state = _LoadState.loaded;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _state = _LoadState.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('Activity')),
      child: SafeArea(
        child: switch (_state) {
          _LoadState.loading => const _SkeletonList(),
          _LoadState.error => _ErrorView(colors: colors, onRetry: _load),
          _LoadState.loaded when _scans.isEmpty => _EmptyView(colors: colors),
          _LoadState.loaded => _ScanList(scans: _scans, colors: colors),
        },
      ),
    );
  }
}

class _SkeletonList extends StatelessWidget {
  const _SkeletonList();

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: MapeeSpacing.sm),
      itemCount: 5,
      separatorBuilder: (context, index) => Container(
        height: 1,
        margin: const EdgeInsets.symmetric(horizontal: MapeeSpacing.md),
        color: colors.separator,
      ),
      itemBuilder: (context, index) => const Padding(
        padding: EdgeInsets.symmetric(horizontal: MapeeSpacing.md, vertical: MapeeSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            MapeeSkeleton(height: 16, width: 160),
            SizedBox(height: MapeeSpacing.xs),
            MapeeSkeleton(height: 13, width: 220),
          ],
        ),
      ),
    );
  }
}

class _ScanList extends StatelessWidget {
  const _ScanList({required this.scans, required this.colors});

  final List<MyScan> scans;
  final MapeeColors colors;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: MapeeSpacing.sm),
      itemCount: scans.length,
      separatorBuilder: (context, index) => Container(
        height: 1,
        margin: const EdgeInsets.symmetric(horizontal: MapeeSpacing.md),
        color: colors.separator,
      ),
      itemBuilder: (context, index) {
        final scan = scans[index];
        return Dismissible(
          key: ValueKey(scan.id),
          direction: DismissDirection.endToStart,
          // There's no per-scan delete endpoint (only bulk delete-everything,
          // already surfaced via Settings), so the only swipe action that
          // makes sense here is Share. `confirmDismiss` always returns
          // false, so the swipe reveals the Share affordance and triggers it
          // without ever actually removing the row.
          background: Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.md),
            color: colors.accent,
            child: const Icon(CupertinoIcons.share, color: CupertinoColors.white),
          ),
          confirmDismiss: (_) async {
            MapeeHaptics.selectionClick();
            SharePlus.instance.share(ShareParams(text: composeScanShareText(scan)));
            return false;
          },
          child: MapeeRow(
            title: scan.ispDisplayName,
            subtitle: scanListSummary(scan),
            onTap: () => Navigator.of(context).push(
              CupertinoPageRoute(builder: (context) => ScanDetailScreen(scan: scan)),
            ),
          ),
        );
      },
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView({required this.colors});

  final MapeeColors colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(MapeeSpacing.lg),
        child: Text(
          "You haven't run any scans yet.",
          textAlign: TextAlign.center,
          style: MapeeTypography.body.copyWith(color: colors.secondaryLabel),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.colors, required this.onRetry});

  final MapeeColors colors;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(MapeeSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(CupertinoIcons.exclamationmark_triangle, size: 48, color: colors.secondaryLabel),
            const SizedBox(height: MapeeSpacing.md),
            Text(
              "Couldn't load your scans.",
              textAlign: TextAlign.center,
              style: MapeeTypography.body.copyWith(color: colors.label),
            ),
            const SizedBox(height: MapeeSpacing.lg),
            MapeeButton(label: 'Try Again', onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}
