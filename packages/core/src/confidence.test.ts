import { describe, it, expect } from "vitest";
import {
  getFreshnessWeight,
  filterFreshPings,
  calculateWeightedAverageLatency,
  getConfidenceLevel,
  calculateConfidenceScore,
  calculateConsistency,
  getTopISP,
  getISPRankings,
} from "./confidence";
import type { PingLog } from "./types";

const DAY = 24 * 60 * 60 * 1000;

function ping(overrides: Partial<PingLog> = {}): PingLog {
  return {
    id: Math.random().toString(36).slice(2),
    lat: 6.5244,
    lng: 3.3792,
    reportedISP: "MTN Nigeria",
    verifiedASN: null,
    latencyMs: 50,
    jitter: 5,
    uploadSpeed: 10,
    downloadSpeed: 40,
    timestamp: Date.now(),
    deviceType: "mobile",
    userAgent: "test",
    ...overrides,
  };
}

/** A ping aged `days` old. */
function aged(days: number, overrides: Partial<PingLog> = {}): PingLog {
  return ping({ timestamp: Date.now() - days * DAY, ...overrides });
}

describe("getFreshnessWeight", () => {
  it("weights pings inside the fresh window at 1.0", () => {
    expect(getFreshnessWeight(Date.now())).toBe(1.0);
    expect(getFreshnessWeight(Date.now() - 6 * DAY)).toBe(1.0);
  });

  it("weights stale pings at 0.5", () => {
    expect(getFreshnessWeight(Date.now() - 10 * DAY)).toBe(0.5);
    expect(getFreshnessWeight(Date.now() - 29 * DAY)).toBe(0.5);
  });

  it("drops expired pings to 0", () => {
    expect(getFreshnessWeight(Date.now() - 31 * DAY)).toBe(0);
    expect(getFreshnessWeight(Date.now() - 365 * DAY)).toBe(0);
  });

  // Future timestamps produce a negative age. Currently these fall into the
  // fresh bucket, which is the lenient reading — pinned so a change is visible.
  it("treats future timestamps as fresh", () => {
    expect(getFreshnessWeight(Date.now() + 5 * DAY)).toBe(1.0);
  });
});

describe("filterFreshPings", () => {
  it("removes only expired pings", () => {
    const kept = [aged(0), aged(10)];
    const dropped = [aged(45)];
    expect(filterFreshPings([...kept, ...dropped])).toHaveLength(2);
  });

  it("returns empty for an empty input", () => {
    expect(filterFreshPings([])).toEqual([]);
  });
});

describe("calculateWeightedAverageLatency", () => {
  it("returns 0 with no fresh pings", () => {
    expect(calculateWeightedAverageLatency([])).toBe(0);
    expect(calculateWeightedAverageLatency([aged(60)])).toBe(0);
  });

  it("weights fresh samples above stale ones", () => {
    // fresh 100 (w=1.0), stale 200 (w=0.5) -> (100 + 100) / 1.5 = 133
    expect(
      calculateWeightedAverageLatency([
        aged(1, { latencyMs: 100 }),
        aged(20, { latencyMs: 200 }),
      ])
    ).toBe(133);
  });

  it("equals the plain mean when all pings are equally fresh", () => {
    expect(
      calculateWeightedAverageLatency([
        aged(1, { latencyMs: 40 }),
        aged(1, { latencyMs: 60 }),
      ])
    ).toBe(50);
  });
});

describe("getConfidenceLevel", () => {
  it("bands the score", () => {
    expect(getConfidenceLevel(100)).toBe("high");
    expect(getConfidenceLevel(70)).toBe("high");
    expect(getConfidenceLevel(69)).toBe("medium");
    expect(getConfidenceLevel(40)).toBe("medium");
    expect(getConfidenceLevel(39)).toBe("low");
    expect(getConfidenceLevel(0)).toBe("low");
  });
});

describe("calculateConfidenceScore", () => {
  it("returns 0 with no fresh pings", () => {
    expect(calculateConfidenceScore([])).toBe(0);
    expect(calculateConfidenceScore([aged(90)])).toBe(0);
  });

  it("caps at 100", () => {
    const many = Array.from({ length: 200 }, () => aged(0, { latencyMs: 50 }));
    expect(calculateConfidenceScore(many)).toBe(100);
  });

  it("scores consistent samples above erratic ones", () => {
    const consistent = [50, 50, 50, 50].map((l) => aged(0, { latencyMs: l }));
    const erratic = [10, 200, 30, 400].map((l) => aged(0, { latencyMs: l }));
    expect(calculateConfidenceScore(consistent)).toBeGreaterThan(
      calculateConfidenceScore(erratic)
    );
  });

  it("scores more samples above fewer, all else equal", () => {
    const few = [50, 60].map((l) => aged(0, { latencyMs: l }));
    const many = [50, 60, 50, 60, 50, 60].map((l) => aged(0, { latencyMs: l }));
    expect(calculateConfidenceScore(many)).toBeGreaterThan(
      calculateConfidenceScore(few)
    );
  });
});

describe("calculateConsistency", () => {
  it("returns 0 with no fresh pings", () => {
    expect(calculateConsistency([])).toBe(0);
  });

  it("reports the percentage under the threshold", () => {
    const pings = [50, 80, 300, 400].map((l) => aged(0, { latencyMs: l }));
    expect(calculateConsistency(pings)).toBe(50); // 2 of 4 under 100ms
  });

  it("honours a custom threshold", () => {
    const pings = [50, 80, 300, 400].map((l) => aged(0, { latencyMs: l }));
    expect(calculateConsistency(pings, 60)).toBe(25); // only the 50ms sample
  });
});

describe("getTopISP", () => {
  it("returns a sentinel with no fresh data", () => {
    expect(getTopISP([])).toBe("No Data");
    expect(getTopISP([aged(90)])).toBe("No Data");
  });

  it("picks the most frequently reported ISP", () => {
    const pings = [
      aged(0, { reportedISP: "MTN Nigeria" }),
      aged(0, { reportedISP: "MTN Nigeria" }),
      aged(0, { reportedISP: "Airtel Nigeria" }),
    ];
    expect(getTopISP(pings)).toBe("MTN Nigeria");
  });

  // Documented tie-break: equal counts resolve to the lower average latency.
  it("breaks ties on lower average latency", () => {
    const pings = [
      aged(0, { reportedISP: "Slow ISP", latencyMs: 300 }),
      aged(0, { reportedISP: "Fast ISP", latencyMs: 20 }),
    ];
    expect(getTopISP(pings)).toBe("Fast ISP");
  });
});

describe("getISPRankings", () => {
  it("returns empty with no fresh data", () => {
    expect(getISPRankings([])).toEqual([]);
  });

  it("sorts fastest first and counts samples", () => {
    const pings = [
      aged(0, { reportedISP: "Slow", latencyMs: 300 }),
      aged(0, { reportedISP: "Fast", latencyMs: 20 }),
      aged(0, { reportedISP: "Fast", latencyMs: 40 }),
    ];
    const rankings = getISPRankings(pings);
    expect(rankings.map((r) => r.isp)).toEqual(["Fast", "Slow"]);
    expect(rankings[0]).toMatchObject({ avgLatency: 30, count: 2 });
  });

  it("excludes expired pings from rankings", () => {
    const rankings = getISPRankings([
      aged(0, { reportedISP: "Current" }),
      aged(90, { reportedISP: "Ancient" }),
    ]);
    expect(rankings.map((r) => r.isp)).toEqual(["Current"]);
  });
});
