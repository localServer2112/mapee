import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/isp_ranking_repository.dart';
import 'package:mapee_mobile/design/primitives/mapee_skeleton.dart';
import 'package:mapee_mobile/domain/entities/isp_ranking.dart';
import 'package:mapee_mobile/features/insights/insights_screen.dart';

class _FakeIspRankingRepository extends IspRankingRepository {
  _FakeIspRankingRepository(this._rankings) : super(ApiClient());

  final List<IspRanking> _rankings;

  @override
  Future<List<IspRanking>> fetchRankings() async => _rankings;
}

void main() {
  testWidgets('goes from loading to the honest empty state when there are no rankings', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ispRankingRepositoryProvider.overrideWithValue(_FakeIspRankingRepository(const [])),
        ],
        child: const CupertinoApp(home: InsightsScreen()),
      ),
    );

    expect(find.byType(MapeeSkeleton), findsWidgets);

    await tester.pump();

    expect(find.byType(MapeeSkeleton), findsNothing);
    expect(find.text('No measured data yet'), findsOneWidget);
    expect(find.textContaining('coming soon'), findsOneWidget);
  });

  testWidgets('goes from loading to a populated list showing an ISP row', (tester) async {
    const rankings = [
      IspRanking(
        isp: 'MTN Nigeria',
        avgLatencyMs: 142,
        medianLatencyMs: 130,
        avgJitterMs: 12,
        sampleCount: 1204,
        avgDownloadMbps: 8.5,
        avgUploadMbps: 2.1,
      ),
    ];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ispRankingRepositoryProvider.overrideWithValue(_FakeIspRankingRepository(rankings)),
        ],
        child: const CupertinoApp(home: InsightsScreen()),
      ),
    );

    expect(find.byType(MapeeSkeleton), findsWidgets);

    await tester.pump();

    expect(find.byType(MapeeSkeleton), findsNothing);
    // "MTN Nigeria" appears twice: once as the chart's axis label, once as
    // the row title below it.
    expect(find.text('MTN Nigeria'), findsWidgets);
    expect(find.textContaining('142 ms avg'), findsOneWidget);
    expect(find.text('No measured data yet'), findsNothing);
  });

  testWidgets('the info button opens a methodology sheet explaining measured-only rankings', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ispRankingRepositoryProvider.overrideWithValue(_FakeIspRankingRepository(const [])),
        ],
        child: const CupertinoApp(home: InsightsScreen()),
      ),
    );

    await tester.pump();

    expect(find.text('How rankings are calculated'), findsNothing);

    await tester.tap(find.byIcon(CupertinoIcons.info_circle));
    await tester.pumpAndSettle();

    expect(find.text('How rankings are calculated'), findsOneWidget);
    expect(find.textContaining('measured'), findsWidgets);
  });
}
