import { describe, it, expect } from "vitest";
import { ConfigSchema } from "./config";

describe("ConfigSchema", () => {
  it("accepts a realistic config payload", () => {
    expect(
      ConfigSchema.safeParse({
        ispList: ["MTN Nigeria", "Airtel Nigeria"],
        latencyThresholds: { good: 50, fair: 150 },
        dataFreshness: { freshDays: 7, staleDays: 30, expiredDays: 30 },
        measurementEndpoints: {
          download: "https://speed.cloudflare.com/__down",
          upload: "https://speed.cloudflare.com/__up",
        },
        minSupportedVersion: "0.1.0",
      }).success
    ).toBe(true);
  });

  it("rejects a non-URL measurement endpoint", () => {
    expect(
      ConfigSchema.safeParse({
        ispList: [],
        latencyThresholds: { good: 50, fair: 150 },
        dataFreshness: { freshDays: 7, staleDays: 30, expiredDays: 30 },
        measurementEndpoints: { download: "not-a-url", upload: "https://x.test/up" },
        minSupportedVersion: "0.1.0",
      }).success
    ).toBe(false);
  });
});
