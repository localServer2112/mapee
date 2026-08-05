import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockSupabaseConfigured = { value: true };

vi.mock("../lib/supabase.js", () => ({
  get supabase() {
    return mockSupabaseConfigured.value ? { rpc: mockRpc } : null;
  },
  get isSupabaseConfigured() {
    return mockSupabaseConfigured.value;
  },
}));

import { app } from "../app.js";

const SCAN_ROW_FIXTURE = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  lat_grid: 6.5266,
  lng_grid: 3.3775,
  reported_isp: "MTN Nigeria",
  verified_asn: null,
  latency_ms: 42,
  jitter: 5,
  upload_speed: "12.50", // Postgres DECIMAL columns come back as strings
  download_speed: "45.20",
  device_type: "mobile",
  measurement_method: "heuristic",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("GET /v1/scans", () => {
  beforeEach(() => {
    mockSupabaseConfigured.value = true;
    mockRpc.mockReset();
  });

  it("returns grid-snapped coordinates, never exact ones — the core fix from plan §7.5 item 1", async () => {
    mockRpc.mockResolvedValue({ data: [SCAN_ROW_FIXTURE], error: null });
    const res = await app.request("/v1/scans?bbox=6.4,3.3,6.7,3.5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        lat: 6.5266,
        lng: 3.3775,
        reportedISP: "MTN Nigeria",
        verifiedASN: null,
        latencyMs: 42,
        jitter: 5,
        uploadSpeed: 12.5,
        downloadSpeed: 45.2,
        measurementMethod: "heuristic",
        deviceType: "mobile",
        timestamp: new Date("2026-01-01T00:00:00.000Z").getTime(),
      },
    ]);
  });

  it("calls the RPC with south/west/north/east parsed from bbox and the requested maxAge", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await app.request("/v1/scans?bbox=6.4,3.3,6.7,3.5&maxAge=45");
    expect(mockRpc).toHaveBeenCalledWith("get_pings_in_bounds", {
      south: 6.4,
      west: 3.3,
      north: 6.7,
      east: 3.5,
      max_age_days: 45,
    });
  });

  it("defaults maxAge to 30 when omitted", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await app.request("/v1/scans?bbox=6.4,3.3,6.7,3.5");
    expect(mockRpc).toHaveBeenCalledWith(
      "get_pings_in_bounds",
      expect.objectContaining({ max_age_days: 30 })
    );
  });

  it("rejects maxAge above 90 at the validation layer, not silently clamping", async () => {
    const res = await app.request("/v1/scans?bbox=6.4,3.3,6.7,3.5&maxAge=365");
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects north < south before ever calling the database", async () => {
    const res = await app.request("/v1/scans?bbox=6.7,3.3,6.4,3.5");
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 200 with an empty array when Supabase isn't configured, not an error", async () => {
    mockSupabaseConfigured.value = false;
    const res = await app.request("/v1/scans?bbox=6.4,3.3,6.7,3.5");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(res.headers.get("x-database-status")).toBe("not-configured");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 500 via the shared error envelope on a database error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const res = await app.request("/v1/scans?bbox=6.4,3.3,6.7,3.5");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "database_error", message: "Failed to fetch scan data" },
    });
  });

  it("drops a malformed row rather than failing the whole request", async () => {
    mockRpc.mockResolvedValue({
      data: [SCAN_ROW_FIXTURE, { ...SCAN_ROW_FIXTURE, id: "not-a-uuid" }],
      error: null,
    });
    const res = await app.request("/v1/scans?bbox=6.4,3.3,6.7,3.5");
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
  });

  it("appears in the served OpenAPI document", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(doc.paths ?? {})).toContain("/v1/scans");
  });
});
