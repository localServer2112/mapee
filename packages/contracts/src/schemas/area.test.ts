import { describe, it, expect } from "vitest";
import { AreaSchema, AreaListQuerySchema } from "./area";

// Shaped like the transform in GET /api/stats (apps/web/src/app/api/stats/route.ts)
// applied to a get_hexbin_stats_in_bounds row, minus the `pings: []` field —
// v1 never claims to include per-ping detail in an aggregate, so it isn't in
// the schema at all rather than being present-but-always-empty.
const validArea = {
  id: "1523_-751",
  centerLat: 6.5266,
  centerLng: 3.3775,
  avgLatency: 68,
  minLatency: 12,
  maxLatency: 340,
  scanCount: 14,
  topISP: "MTN Nigeria",
  confidence: 62,
  consistency: 71,
};

describe("AreaSchema", () => {
  it("accepts a realistic aggregated cell", () => {
    expect(AreaSchema.safeParse(validArea).success).toBe(true);
  });

  it("treats id as an opaque string, not a parsed coordinate pair", () => {
    // The legacy /api/stats route parses hex_id into numeric x/y. v1
    // deliberately does not — clients must not depend on the id's internal
    // structure, since the binning scheme is a server detail (plan §8).
    expect(AreaSchema.shape.id).toBeInstanceOf(Object);
    expect(AreaSchema.safeParse({ ...validArea, id: "anything-opaque" }).success).toBe(true);
  });

  it("rejects a confidence score outside 0-100", () => {
    expect(AreaSchema.safeParse({ ...validArea, confidence: 101 }).success).toBe(false);
    expect(AreaSchema.safeParse({ ...validArea, confidence: -1 }).success).toBe(false);
  });

  it("rejects a negative scan count", () => {
    expect(AreaSchema.safeParse({ ...validArea, scanCount: -1 }).success).toBe(false);
  });
});

describe("AreaListQuerySchema", () => {
  it("accepts bbox alone, zoom is optional", () => {
    expect(AreaListQuerySchema.safeParse({ bbox: "6.4,3.3,6.7,3.5" }).success).toBe(true);
  });

  it("coerces zoom from a query string", () => {
    const result = AreaListQuerySchema.safeParse({ bbox: "6.4,3.3,6.7,3.5", zoom: "14" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.zoom).toBe(14);
  });
});
