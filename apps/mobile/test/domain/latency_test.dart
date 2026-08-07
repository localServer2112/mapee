import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/domain/constants.dart';
import 'package:mapee_mobile/domain/latency.dart';

void main() {
  group('getLatencyStatus', () {
    test('classifies by threshold', () {
      expect(getLatencyStatus(0), LatencyStatus.good);
      expect(getLatencyStatus(49), LatencyStatus.good);
      expect(getLatencyStatus(120), LatencyStatus.fair);
      expect(getLatencyStatus(1000), LatencyStatus.poor);
    });

    // The thresholds are inclusive upper bounds; a value exactly on the
    // boundary belongs to the better tier. Worth pinning: the SQL in
    // hexbin_stats and the TS port both have to agree with this.
    test('treats threshold boundaries as inclusive', () {
      expect(getLatencyStatus(LatencyThresholds.good), LatencyStatus.good);
      expect(getLatencyStatus(LatencyThresholds.good + 1), LatencyStatus.fair);
      expect(getLatencyStatus(LatencyThresholds.fair), LatencyStatus.fair);
      expect(getLatencyStatus(LatencyThresholds.fair + 1), LatencyStatus.poor);
    });
  });

  group('getLatencyLabel', () {
    test('maps every status to a label', () {
      expect(getLatencyLabel(LatencyStatus.good), 'Excellent');
      expect(getLatencyLabel(LatencyStatus.fair), 'Average');
      expect(getLatencyLabel(LatencyStatus.poor), 'Poor');
    });
  });

  group('calculateAverageLatency', () {
    test('returns 0 for an empty sample set', () {
      expect(calculateAverageLatency([]), 0);
    });

    test('rounds to the nearest integer', () {
      expect(calculateAverageLatency([10, 11]), 11); // 10.5 rounds up
      expect(calculateAverageLatency([10, 20, 30]), 20);
    });
  });

  group('calculateMedianLatency', () {
    test('returns 0 for an empty sample set', () {
      expect(calculateMedianLatency([]), 0);
    });

    test('takes the middle value for odd counts', () {
      expect(calculateMedianLatency([30, 10, 20]), 20);
    });

    test('averages the two middle values for even counts', () {
      expect(calculateMedianLatency([10, 20, 30, 40]), 25);
    });

    test('does not mutate its input', () {
      final samples = [30, 10, 20];
      calculateMedianLatency(samples);
      expect(samples, [30, 10, 20]);
    });
  });

  group('calculateJitter', () {
    // Guards a real division-by-zero / NaN path: a single-sample test run
    // must report 0 jitter, not NaN.
    test('returns 0 with fewer than two samples', () {
      expect(calculateJitter([]), 0);
      expect(calculateJitter([42]), 0);
    });

    test('returns 0 for identical samples', () {
      expect(calculateJitter([50, 50, 50]), 0);
    });

    test('computes population standard deviation, rounded', () {
      // mean 30, deviations -20/0/+20, variance 800/3 = 266.67, sd = 16.33
      expect(calculateJitter([10, 30, 50]), 16);
    });

    test('never returns NaN for any finite input', () {
      for (final samples in [
        <int>[0],
        <int>[0, 0],
        <int>[1000000, 0],
      ]) {
        expect(calculateJitter(samples).isNaN, false);
      }
    });
  });
}
