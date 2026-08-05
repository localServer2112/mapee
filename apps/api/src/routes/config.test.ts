import { describe, it, expect } from "vitest";
import { ConfigSchema, type Config } from "@mapee/contracts";
import { ISP_LIST, LATENCY_THRESHOLDS, DATA_FRESHNESS } from "@mapee/core";
import { app } from "../app";

describe("GET /v1/config", () => {
  it("returns a body that validates against ConfigSchema", async () => {
    const res = await app.request("/v1/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    const result = ConfigSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it("mirrors @mapee/core's ISP_LIST and thresholds exactly, not a hand-copied duplicate", async () => {
    const res = await app.request("/v1/config");
    const body = (await res.json()) as Config;

    expect(body.ispList).toEqual([...ISP_LIST]);
    expect(body.latencyThresholds).toEqual({
      good: LATENCY_THRESHOLDS.GOOD,
      fair: LATENCY_THRESHOLDS.FAIR,
    });
    expect(body.dataFreshness).toEqual({
      freshDays: DATA_FRESHNESS.FRESH_DAYS,
      staleDays: DATA_FRESHNESS.STALE_DAYS,
      expiredDays: DATA_FRESHNESS.EXPIRED_DAYS,
    });
  });

  it("points measurement endpoints at real, resolvable URLs rather than a placeholder", async () => {
    const res = await app.request("/v1/config");
    const body = (await res.json()) as Config;

    expect(body.measurementEndpoints.download).toMatch(/^https:\/\//);
    expect(body.measurementEndpoints.upload).toMatch(/^https:\/\//);
  });

  it("appears in the served OpenAPI document", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(doc.paths ?? {})).toContain("/v1/config");
  });
});
