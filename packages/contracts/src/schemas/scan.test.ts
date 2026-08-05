import { describe, it, expect } from "vitest";
import {
  ScanSchema,
  ScanDetailSchema,
  ScanListQuerySchema,
  CreateScanRequestSchema,
  CreateScanResponseSchema,
} from "./scan";

// Sample shaped like what GET /api/pings actually returns today (see
// apps/web/src/app/api/pings/route.ts), with field names carried over as-is
// since those don't change in v1 — only the coordinate precision and the
// added measurementMethod field do.
const validScan = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  lat: 6.5244,
  lng: 3.3792,
  reportedISP: "MTN Nigeria",
  verifiedASN: null,
  latencyMs: 42,
  jitter: 5,
  uploadSpeed: 12.5,
  downloadSpeed: 45.2,
  measurementMethod: "measured",
  deviceType: "mobile",
  timestamp: 1735689600000,
};

describe("ScanSchema", () => {
  it("accepts a realistic scan", () => {
    expect(ScanSchema.safeParse(validScan).success).toBe(true);
  });

  it("accepts null verifiedASN", () => {
    expect(ScanSchema.safeParse({ ...validScan, verifiedASN: null }).success).toBe(true);
  });

  it("rejects an ISP not in the canonical list", () => {
    const result = ScanSchema.safeParse({ ...validScan, reportedISP: "Some Random ISP" });
    expect(result.success).toBe(false);
  });

  it("rejects negative latency", () => {
    expect(ScanSchema.safeParse({ ...validScan, latencyMs: -1 }).success).toBe(false);
  });

  it("rejects out-of-range latitude", () => {
    expect(ScanSchema.safeParse({ ...validScan, lat: 91 }).success).toBe(false);
  });

  it("rejects an unknown measurementMethod", () => {
    expect(ScanSchema.safeParse({ ...validScan, measurementMethod: "guessed" }).success).toBe(
      false
    );
  });
});

describe("ScanDetailSchema", () => {
  it("requires isLocationExact, unlike the list schema", () => {
    expect(ScanDetailSchema.safeParse(validScan).success).toBe(false);
    expect(
      ScanDetailSchema.safeParse({ ...validScan, isLocationExact: true }).success
    ).toBe(true);
  });
});

describe("ScanListQuerySchema", () => {
  it("accepts a bbox in south,west,north,east order", () => {
    const result = ScanListQuerySchema.safeParse({ bbox: "6.4,3.3,6.7,3.5" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed bbox", () => {
    expect(ScanListQuerySchema.safeParse({ bbox: "not,a,bbox" }).success).toBe(false);
  });

  it("defaults maxAge to 30 and coerces the query string", () => {
    const result = ScanListQuerySchema.safeParse({ bbox: "6.4,3.3,6.7,3.5", maxAge: "15" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.maxAge).toBe(15);

    const withoutMaxAge = ScanListQuerySchema.safeParse({ bbox: "6.4,3.3,6.7,3.5" });
    expect(withoutMaxAge.success).toBe(true);
    if (withoutMaxAge.success) expect(withoutMaxAge.data.maxAge).toBe(30);
  });

  it("rejects maxAge above the 90-day cap", () => {
    expect(
      ScanListQuerySchema.safeParse({ bbox: "6.4,3.3,6.7,3.5", maxAge: "91" }).success
    ).toBe(false);
  });
});

describe("CreateScanRequestSchema", () => {
  const body = {
    lat: 6.5244,
    lng: 3.3792,
    reportedISP: "MTN Nigeria",
    latencyMs: 42,
    jitter: 5,
    uploadSpeed: 12.5,
    downloadSpeed: 45.2,
    deviceType: "mobile",
  };

  it("accepts a submission with no client-supplied id", () => {
    expect(CreateScanRequestSchema.safeParse(body).success).toBe(true);
  });

  it("accepts a client-supplied UUID for idempotent retry", () => {
    expect(
      CreateScanRequestSchema.safeParse({
        ...body,
        id: "550e8400-e29b-41d4-a716-446655440000",
      }).success
    ).toBe(true);
  });

  it("rejects a non-UUID id rather than silently ignoring it", () => {
    expect(CreateScanRequestSchema.safeParse({ ...body, id: "not-a-uuid" }).success).toBe(false);
  });

  it("has no userAgent field — the server reads the header instead", () => {
    const parsed = CreateScanRequestSchema.safeParse({ ...body, userAgent: "Mozilla/5.0" });
    // Zod's default is to strip unknown keys, not reject them, so this
    // still parses — but the output must not carry userAgent through.
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("userAgent" in parsed.data).toBe(false);
    }
  });
});

describe("CreateScanResponseSchema", () => {
  it("accepts the shape POST /api/pings returns today", () => {
    expect(
      CreateScanResponseSchema.safeParse({
        success: true,
        id: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: 1735689600000,
      }).success
    ).toBe(true);
  });

  it("rejects success: false — that path is an error response, not this schema", () => {
    expect(
      CreateScanResponseSchema.safeParse({
        success: false,
        id: "x",
        timestamp: 0,
      }).success
    ).toBe(false);
  });
});
