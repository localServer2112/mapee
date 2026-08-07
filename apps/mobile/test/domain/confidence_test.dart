import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/domain/confidence.dart';
import 'package:mapee_mobile/domain/entities/ping_log.dart';

PingLog ping({
  String reportedIsp = 'MTN Nigeria',
  int latencyMs = 50,
  DateTime? timestamp,
}) {
  return PingLog(
    latencyMs: latencyMs,
    reportedIsp: reportedIsp,
    timestamp: timestamp ?? DateTime.now(),
  );
}

/// A ping aged [days] old.
PingLog aged(num days, {String reportedIsp = 'MTN Nigeria', int latencyMs = 50}) {
  return ping(
    reportedIsp: reportedIsp,
    latencyMs: latencyMs,
    timestamp: DateTime.now().subtract(Duration(milliseconds: (days * 24 * 60 * 60 * 1000).round())),
  );
}

void main() {
  group('getFreshnessWeight', () {
    test('weights pings inside the fresh window at 1.0', () {
      expect(getFreshnessWeight(DateTime.now()), 1.0);
      expect(getFreshnessWeight(DateTime.now().subtract(const Duration(days: 6))), 1.0);
    });

    test('weights stale pings at 0.5', () {
      expect(getFreshnessWeight(DateTime.now().subtract(const Duration(days: 10))), 0.5);
      expect(getFreshnessWeight(DateTime.now().subtract(const Duration(days: 29))), 0.5);
    });

    test('drops expired pings to 0', () {
      expect(getFreshnessWeight(DateTime.now().subtract(const Duration(days: 31))), 0);
      expect(getFreshnessWeight(DateTime.now().subtract(const Duration(days: 365))), 0);
    });

    // Future timestamps produce a negative age. Currently these fall into
    // the fresh bucket, which is the lenient reading -- pinned so a change
    // is visible.
    test('treats future timestamps as fresh', () {
      expect(getFreshnessWeight(DateTime.now().add(const Duration(days: 5))), 1.0);
    });
  });

  group('filterFreshPings', () {
    test('removes only expired pings', () {
      final kept = [aged(0), aged(10)];
      final dropped = [aged(45)];
      expect(filterFreshPings([...kept, ...dropped]), hasLength(2));
    });

    test('returns empty for an empty input', () {
      expect(filterFreshPings([]), <PingLog>[]);
    });
  });

  group('calculateWeightedAverageLatency', () {
    test('returns 0 with no fresh pings', () {
      expect(calculateWeightedAverageLatency([]), 0);
      expect(calculateWeightedAverageLatency([aged(60)]), 0);
    });

    test('weights fresh samples above stale ones', () {
      // fresh 100 (w=1.0), stale 200 (w=0.5) -> (100 + 100) / 1.5 = 133
      expect(
        calculateWeightedAverageLatency([
          aged(1, latencyMs: 100),
          aged(20, latencyMs: 200),
        ]),
        133,
      );
    });

    test('equals the plain mean when all pings are equally fresh', () {
      expect(
        calculateWeightedAverageLatency([
          aged(1, latencyMs: 40),
          aged(1, latencyMs: 60),
        ]),
        50,
      );
    });
  });

  group('getConfidenceLevel', () {
    test('bands the score', () {
      expect(getConfidenceLevel(100), ConfidenceLevel.high);
      expect(getConfidenceLevel(70), ConfidenceLevel.high);
      expect(getConfidenceLevel(69), ConfidenceLevel.medium);
      expect(getConfidenceLevel(40), ConfidenceLevel.medium);
      expect(getConfidenceLevel(39), ConfidenceLevel.low);
      expect(getConfidenceLevel(0), ConfidenceLevel.low);
    });
  });

  group('calculateConfidenceScore', () {
    test('returns 0 with no fresh pings', () {
      expect(calculateConfidenceScore([]), 0);
      expect(calculateConfidenceScore([aged(90)]), 0);
    });

    test('caps at 100', () {
      final many = List.generate(200, (_) => aged(0, latencyMs: 50));
      expect(calculateConfidenceScore(many), 100);
    });

    test('scores consistent samples above erratic ones', () {
      final consistent = [50, 50, 50, 50].map((l) => aged(0, latencyMs: l)).toList();
      final erratic = [10, 200, 30, 400].map((l) => aged(0, latencyMs: l)).toList();
      expect(
        calculateConfidenceScore(consistent),
        greaterThan(calculateConfidenceScore(erratic)),
      );
    });

    test('scores more samples above fewer, all else equal', () {
      final few = [50, 60].map((l) => aged(0, latencyMs: l)).toList();
      final many = [50, 60, 50, 60, 50, 60].map((l) => aged(0, latencyMs: l)).toList();
      expect(
        calculateConfidenceScore(many),
        greaterThan(calculateConfidenceScore(few)),
      );
    });
  });

  group('calculateConsistency', () {
    test('returns 0 with no fresh pings', () {
      expect(calculateConsistency([]), 0);
    });

    test('reports the percentage under the threshold', () {
      final pings = [50, 80, 300, 400].map((l) => aged(0, latencyMs: l)).toList();
      expect(calculateConsistency(pings), 50); // 2 of 4 under 100ms
    });

    test('honours a custom threshold', () {
      final pings = [50, 80, 300, 400].map((l) => aged(0, latencyMs: l)).toList();
      expect(calculateConsistency(pings, 60), 25); // only the 50ms sample
    });
  });

  group('getTopISP', () {
    test('returns a sentinel with no fresh data', () {
      expect(getTopISP([]), 'No Data');
      expect(getTopISP([aged(90)]), 'No Data');
    });

    test('picks the most frequently reported ISP', () {
      final pings = [
        aged(0, reportedIsp: 'MTN Nigeria'),
        aged(0, reportedIsp: 'MTN Nigeria'),
        aged(0, reportedIsp: 'Airtel Nigeria'),
      ];
      expect(getTopISP(pings), 'MTN Nigeria');
    });

    // Documented tie-break: equal counts resolve to the lower average latency.
    test('breaks ties on lower average latency', () {
      final pings = [
        aged(0, reportedIsp: 'Slow ISP', latencyMs: 300),
        aged(0, reportedIsp: 'Fast ISP', latencyMs: 20),
      ];
      expect(getTopISP(pings), 'Fast ISP');
    });
  });

  group('getISPRankings', () {
    test('returns empty with no fresh data', () {
      expect(getISPRankings([]), <IspRanking>[]);
    });

    test('sorts fastest first and counts samples', () {
      final pings = [
        aged(0, reportedIsp: 'Slow', latencyMs: 300),
        aged(0, reportedIsp: 'Fast', latencyMs: 20),
        aged(0, reportedIsp: 'Fast', latencyMs: 40),
      ];
      final rankings = getISPRankings(pings);
      expect(rankings.map((r) => r.isp).toList(), ['Fast', 'Slow']);
      expect(rankings[0].avgLatency, 30);
      expect(rankings[0].count, 2);
    });

    test('excludes expired pings from rankings', () {
      final rankings = getISPRankings([
        aged(0, reportedIsp: 'Current'),
        aged(90, reportedIsp: 'Ancient'),
      ]);
      expect(rankings.map((r) => r.isp).toList(), ['Current']);
    });
  });
}
