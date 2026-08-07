import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/isp_ranking_repository.dart';
import '../../design/primitives/mapee_chip.dart';
import '../../design/primitives/mapee_row.dart';
import '../../design/primitives/mapee_sheet.dart';
import '../../design/primitives/mapee_skeleton.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import '../../domain/entities/isp_ranking.dart';

/// ISP rankings (plan §3's Insights tab), wired to `/v1/isp-rankings`.
///
/// That endpoint is expected to return an empty list in production today —
/// see `IspRankingRepository`'s doc comment — so this screen treats an
/// empty result as a real, honest state rather than an error or a spinner
/// that never resolves.
class InsightsScreen extends ConsumerStatefulWidget {
  const InsightsScreen({super.key});

  @override
  ConsumerState<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends ConsumerState<InsightsScreen> {
  late Future<List<IspRanking>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<IspRanking>> _load() => ref.read(ispRankingRepositoryProvider).fetchRankings();

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _future = next);
    await next;
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: const Text('Insights'),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: () => _showMethodologySheet(context),
          child: const Icon(CupertinoIcons.info_circle),
        ),
      ),
      child: SafeArea(
        child: FutureBuilder<List<IspRanking>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const _SkeletonState();
            }

            final rankings = snapshot.data ?? const [];
            return CustomScrollView(
              slivers: [
                CupertinoSliverRefreshControl(onRefresh: _refresh),
                if (rankings.isEmpty)
                  const SliverFillRemaining(hasScrollBody: false, child: _EmptyState())
                else ...[
                  SliverToBoxAdapter(child: _RankingsChart(rankings: rankings)),
                  SliverPadding(
                    padding: const EdgeInsets.only(bottom: MapeeSpacing.lg),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _RankingRow(ranking: rankings[index]),
                        childCount: rankings.length,
                      ),
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

Future<void> _showMethodologySheet(BuildContext context) {
  return MapeeSheet.show(
    context: context,
    builder: (context) => const _MethodologySheetContent(),
  );
}

class _MethodologySheetContent extends StatelessWidget {
  const _MethodologySheetContent();

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('How rankings are calculated', style: MapeeTypography.title2.copyWith(color: colors.label)),
        const SizedBox(height: MapeeSpacing.sm),
        Text(
          'These rankings only include scans with a real measured throughput test — '
          "heuristic or ping-only submissions aren't counted, which is why the list is "
          'often empty today. Each figure is a simple average across those measured '
          'scans for that ISP, and updates as new measured scans come in.',
          style: MapeeTypography.subheadline.copyWith(color: colors.secondaryLabel),
        ),
      ],
    );
  }
}

class _SkeletonState extends StatelessWidget {
  const _SkeletonState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(bottom: MapeeSpacing.lg),
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(MapeeSpacing.md, MapeeSpacing.md, MapeeSpacing.md, MapeeSpacing.sm),
          child: MapeeSkeleton(height: 160, borderRadius: BorderRadius.all(Radius.circular(MapeeSpacing.radiusCard))),
        ),
        for (var i = 0; i < 4; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.md, vertical: MapeeSpacing.sm),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      MapeeSkeleton(height: 16, width: 140),
                      SizedBox(height: MapeeSpacing.xs),
                      MapeeSkeleton(height: 13, width: 200),
                    ],
                  ),
                ),
                const SizedBox(width: MapeeSpacing.sm),
                const MapeeSkeleton(height: 24, width: 70, borderRadius: BorderRadius.all(Radius.circular(12))),
              ],
            ),
          ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(CupertinoIcons.chart_bar, size: 40, color: colors.tertiaryLabel),
          const SizedBox(height: MapeeSpacing.md),
          Text(
            'No measured data yet',
            textAlign: TextAlign.center,
            style: MapeeTypography.headline.copyWith(color: colors.label),
          ),
          const SizedBox(height: MapeeSpacing.sm),
          Text(
            'ISP rankings are based on real throughput tests, which are '
            'coming soon. Once devices can run a measured speed test, '
            'ranked results will show up here.',
            textAlign: TextAlign.center,
            style: MapeeTypography.subheadline.copyWith(color: colors.secondaryLabel),
          ),
        ],
      ),
    );
  }
}

class _RankingsChart extends StatelessWidget {
  const _RankingsChart({required this.rankings});

  final List<IspRanking> rankings;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    final maxLatency = rankings.map((r) => r.avgLatencyMs).reduce((a, b) => a > b ? a : b);

    return Padding(
      padding: const EdgeInsets.fromLTRB(MapeeSpacing.md, MapeeSpacing.md, MapeeSpacing.md, MapeeSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Avg latency by ISP',
            style: MapeeTypography.footnote.copyWith(color: colors.secondaryLabel),
          ),
          const SizedBox(height: MapeeSpacing.sm),
          SizedBox(
            height: 160,
            child: BarChart(
              BarChartData(
                maxY: maxLatency <= 0 ? 10 : maxLatency * 1.2,
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 32,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= rankings.length) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.only(top: MapeeSpacing.xs),
                          child: Text(
                            rankings[index].isp,
                            style: MapeeTypography.caption1.copyWith(color: colors.secondaryLabel),
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                barGroups: [
                  for (var i = 0; i < rankings.length; i++)
                    BarChartGroupData(
                      x: i,
                      barRods: [
                        BarChartRodData(
                          toY: rankings[i].avgLatencyMs.toDouble(),
                          color: _tierColor(colors, rankings[i].avgLatencyMs),
                          width: 18,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RankingRow extends StatelessWidget {
  const _RankingRow({required this.ranking});

  final IspRanking ranking;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    final tier = _tierFor(ranking.avgLatencyMs);
    final samples = ranking.sampleCount == 1 ? '1 sample' : '${ranking.sampleCount} samples';

    return MapeeRow(
      title: ranking.isp,
      subtitle: '${ranking.avgLatencyMs} ms avg · $samples',
      showChevron: false,
      trailing: MapeeChip(
        label: tier.label,
        icon: tier.icon,
        color: _tierColor(colors, ranking.avgLatencyMs),
      ),
    );
  }
}

/// Latency bands mirroring `AreaStats.quality`'s five tiers (plan §4.1), so
/// ISP rankings read consistently with the map's quality colours.
Color _tierColor(MapeeColors colors, int avgLatencyMs) {
  if (avgLatencyMs <= 50) return colors.qualityExcellent;
  if (avgLatencyMs <= 100) return colors.qualityGood;
  if (avgLatencyMs <= 200) return colors.qualityFair;
  if (avgLatencyMs <= 400) return colors.qualityUsable;
  return colors.qualityPoor;
}

({String label, IconData icon}) _tierFor(int avgLatencyMs) {
  if (avgLatencyMs <= 50) return (label: 'Excellent', icon: CupertinoIcons.bolt_fill);
  if (avgLatencyMs <= 100) return (label: 'Good', icon: CupertinoIcons.checkmark_alt_circle_fill);
  if (avgLatencyMs <= 200) return (label: 'Fair', icon: CupertinoIcons.minus_circle_fill);
  if (avgLatencyMs <= 400) return (label: 'Usable', icon: CupertinoIcons.exclamationmark_triangle_fill);
  return (label: 'Poor', icon: CupertinoIcons.xmark_circle_fill);
}
