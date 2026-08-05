import { describe, it, expect } from "vitest";
import {
  getLatencyStatus,
  getLatencyLabel,
  calculateAverageLatency,
  calculateMedianLatency,
  calculateJitter,
} from "./latency";
import { LATENCY_THRESHOLDS } from "./constants";

describe("getLatencyStatus", () => {
  it("classifies by threshold", () => {
    expect(getLatencyStatus(0)).toBe("good");
    expect(getLatencyStatus(49)).toBe("good");
    expect(getLatencyStatus(120)).toBe("fair");
    expect(getLatencyStatus(1000)).toBe("poor");
  });

  // The thresholds are inclusive upper bounds; a value exactly on the boundary
  // belongs to the better tier. Worth pinning: the SQL in hexbin_stats and the
  // Dart port both have to agree with this.
  it("treats threshold boundaries as inclusive", () => {
    expect(getLatencyStatus(LATENCY_THRESHOLDS.GOOD)).toBe("good");
    expect(getLatencyStatus(LATENCY_THRESHOLDS.GOOD + 1)).toBe("fair");
    expect(getLatencyStatus(LATENCY_THRESHOLDS.FAIR)).toBe("fair");
    expect(getLatencyStatus(LATENCY_THRESHOLDS.FAIR + 1)).toBe("poor");
  });
});

describe("getLatencyLabel", () => {
  it("maps every status to a label", () => {
    expect(getLatencyLabel("good")).toBe("Excellent");
    expect(getLatencyLabel("fair")).toBe("Average");
    expect(getLatencyLabel("poor")).toBe("Poor");
  });
});

describe("calculateAverageLatency", () => {
  it("returns 0 for an empty sample set", () => {
    expect(calculateAverageLatency([])).toBe(0);
  });

  it("rounds to the nearest integer", () => {
    expect(calculateAverageLatency([10, 11])).toBe(11); // 10.5 rounds up
    expect(calculateAverageLatency([10, 20, 30])).toBe(20);
  });
});

describe("calculateMedianLatency", () => {
  it("returns 0 for an empty sample set", () => {
    expect(calculateMedianLatency([])).toBe(0);
  });

  it("takes the middle value for odd counts", () => {
    expect(calculateMedianLatency([30, 10, 20])).toBe(20);
  });

  it("averages the two middle values for even counts", () => {
    expect(calculateMedianLatency([10, 20, 30, 40])).toBe(25);
  });

  it("does not mutate its input", () => {
    const samples = [30, 10, 20];
    calculateMedianLatency(samples);
    expect(samples).toEqual([30, 10, 20]);
  });
});

describe("calculateJitter", () => {
  // Guards a real division-by-zero / NaN path: a single-sample test run must
  // report 0 jitter, not NaN, because the value is written to a NOT NULL
  // integer column with a >= 0 check constraint.
  it("returns 0 with fewer than two samples", () => {
    expect(calculateJitter([])).toBe(0);
    expect(calculateJitter([42])).toBe(0);
  });

  it("returns 0 for identical samples", () => {
    expect(calculateJitter([50, 50, 50])).toBe(0);
  });

  it("computes population standard deviation, rounded", () => {
    // mean 30, deviations -20/0/+20, variance 800/3 = 266.67, sd = 16.33
    expect(calculateJitter([10, 30, 50])).toBe(16);
  });

  it("never returns NaN for any finite input", () => {
    for (const samples of [[0], [0, 0], [1e6, 0], [0.1, 0.2]]) {
      expect(Number.isNaN(calculateJitter(samples))).toBe(false);
    }
  });
});
