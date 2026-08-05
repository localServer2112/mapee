import { describe, it, expect, vi, beforeEach } from "vitest";

// supabase.ts's `supabase` client is a module-level singleton built at
// import time from env vars — mocking the module (same principle as mocking
// fetch for geocode/towers or whoiser for network-identify) is how its RPC
// calls get controlled per test, rather than depending on a live database.
const mockRpc = vi.fn();
vi.mock("../lib/supabase.js", () => ({
  get supabase() {
    return mockSupabaseConfigured.value ? { rpc: mockRpc } : null;
  },
  get isSupabaseConfigured() {
    return mockSupabaseConfigured.value;
  },
}));

const mockSupabaseConfigured = { value: true };

import { app } from "../app.js";

const HEXBIN_FIXTURE = [
  {
    hex_id: "1523_-751",
    center_lat: 6.5266,
    center_lng: 3.3775,
    avg_latency: 68,
    min_latency: 12,
    max_latency: 340,
    ping_count: 14,
    top_isp: "MTN Nigeria",
    confidence_score: 62,
    consistency: 71,
  },
];

describe("GET /v1/areas", () => {
  beforeEach(() => {
    mockSupabaseConfigured.value = true;
    mockRpc.mockReset();
  });

  it("transforms a hexbin_stats row into Area shape, with id kept opaque (not parsed into x/y)", async () => {
    mockRpc.mockResolvedValue({ data: HEXBIN_FIXTURE, error: null });
    const res = await app.request("/v1/areas?bbox=6.4,3.3,6.7,3.5");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
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
      },
    ]);
  });

  it("calls the RPC with south/west/north/east parsed from bbox in that order", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await app.request("/v1/areas?bbox=6.4,3.3,6.7,3.5");
    expect(mockRpc).toHaveBeenCalledWith("get_hexbin_stats_in_bounds", {
      south: 6.4,
      west: 3.3,
      north: 6.7,
      east: 3.5,
    });
  });

  it("returns 200 with an empty array and a status header when Supabase isn't configured, not an error", async () => {
    mockSupabaseConfigured.value = false;
    const res = await app.request("/v1/areas?bbox=6.4,3.3,6.7,3.5");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(res.headers.get("x-database-status")).toBe("not-configured");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 500 via the shared error envelope on a database error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const res = await app.request("/v1/areas?bbox=6.4,3.3,6.7,3.5");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "database_error", message: "Failed to fetch statistics" },
    });
  });

  it("drops a malformed row rather than failing the whole request", async () => {
    mockRpc.mockResolvedValue({
      data: [...HEXBIN_FIXTURE, { hex_id: "bad", center_lat: "not-a-number" }],
      error: null,
    });
    const res = await app.request("/v1/areas?bbox=6.4,3.3,6.7,3.5");
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
  });

  it("rejects an invalid bbox before ever calling the database", async () => {
    const res = await app.request("/v1/areas?bbox=not,a,bbox");
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns a bodyless 304 on a repeat request with a matching If-None-Match", async () => {
    mockRpc.mockResolvedValue({ data: HEXBIN_FIXTURE, error: null });
    const first = await app.request("/v1/areas?bbox=1.1,1.1,1.2,1.2");
    const etag = first.headers.get("etag")!;
    expect(etag).toBeTruthy();

    const second = await app.request("/v1/areas?bbox=1.1,1.1,1.2,1.2", {
      headers: { "If-None-Match": etag },
    });
    expect(second.status).toBe(304);
  });

  it("appears in the served OpenAPI document", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(doc.paths ?? {})).toContain("/v1/areas");
  });
});
