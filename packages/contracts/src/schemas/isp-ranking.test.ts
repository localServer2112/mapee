import { describe, it, expect } from "vitest";
import { ISPRankingSchema } from "./isp-ranking";

describe("ISPRankingSchema", () => {
  it("accepts camelCase fields", () => {
    // The current isp_rankings Postgres view returns its raw snake_case
    // columns unchanged (avg_latency, median_latency, ...) — this schema
    // is the normalised v1 shape, not a passthrough of that view.
    expect(
      ISPRankingSchema.safeParse({
        isp: "MTN Nigeria",
        avgLatency: 68,
        medianLatency: 60,
        avgJitter: 8,
        sampleCount: 214,
        avgDownload: 32.1,
        avgUpload: 9.4,
      }).success
    ).toBe(true);
  });

  it("rejects the view's raw snake_case shape", () => {
    expect(
      ISPRankingSchema.safeParse({
        isp: "MTN Nigeria",
        avg_latency: 68,
        median_latency: 60,
        avg_jitter: 8,
        sample_count: 214,
        avg_download: 32.1,
        avg_upload: 9.4,
      }).success
    ).toBe(false);
  });

  it("rejects an ISP outside the canonical list", () => {
    expect(
      ISPRankingSchema.safeParse({
        isp: "Not A Real ISP",
        avgLatency: 1,
        medianLatency: 1,
        avgJitter: 1,
        sampleCount: 1,
        avgDownload: 1,
        avgUpload: 1,
      }).success
    ).toBe(false);
  });
});
