import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRpc = vi.fn();
const mockSupabaseConfigured = { value: true };

// POST /v1/scans's insert chain (`.from("ping_logs").insert(...).select(...).single()`)
// and its duplicate-id lookup chain (`.from("ping_logs").select(...).eq(...).single()`)
// are independent mocks so a test can control each outcome separately.
const mockInsertSingle = vi.fn();
const mockDuplicateLookupSingle = vi.fn();
// Typed with an explicit parameter (rather than `()`) purely so
// `mockInsert.mock.calls[0][0]` below type-checks as the inserted row
// instead of an empty tuple -- the mock itself doesn't need the value.
const mockInsert = vi.fn((row: Record<string, unknown>) => {
  void row;
  return { select: () => ({ single: mockInsertSingle }) };
});
const mockServerFrom = vi.fn(() => ({
  insert: mockInsert,
  select: () => ({ eq: () => ({ single: mockDuplicateLookupSingle }) }),
}));

vi.mock("../lib/supabase.js", () => ({
  get supabase() {
    return mockSupabaseConfigured.value ? { rpc: mockRpc } : null;
  },
  get isSupabaseConfigured() {
    return mockSupabaseConfigured.value;
  },
  createServerClient: () => (mockSupabaseConfigured.value ? { from: mockServerFrom } : null),
}));

const { mockRequireInstallAuth } = vi.hoisted(() => ({ mockRequireInstallAuth: vi.fn() }));

vi.mock("../lib/auth.js", () => ({
  requireInstallAuth: (...args: unknown[]) => mockRequireInstallAuth(...args),
  resolveInstallAuth: vi.fn(),
}));

const { mockScanSubmitRateLimit } = vi.hoisted(() => ({ mockScanSubmitRateLimit: vi.fn() }));

// Mirrors installs.test.ts's approach: keep every other rate limiter's real
// (very permissive) behaviour and override only the one this route uses, so
// the 429 test doesn't need to actually exhaust ten real requests.
vi.mock("../lib/rate-limit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/rate-limit.js")>();
  return {
    ...actual,
    apiRateLimits: { ...actual.apiRateLimits, scanSubmit: mockScanSubmitRateLimit },
  };
});

import { app } from "../app.js";

const INSTALL_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_KEY = "311493eba94b1bf968f104172db5de55bd386dfe76acc39a654453a889759142";

const VALID_SCAN_BODY = {
  lat: 6.5244,
  lng: 3.3792,
  reportedISP: "MTN Nigeria",
  latencyMs: 42,
  jitter: 5,
  uploadSpeed: 12.5,
  downloadSpeed: 45.2,
  deviceType: "mobile",
};

function postScan(body: unknown, token = "some-token") {
  return app.request("/v1/scans", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: { code: "unauthorized", message: "Missing or invalid install token" } }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

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

describe("POST /v1/scans", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    mockSupabaseConfigured.value = true;
    mockInsert.mockClear();
    mockServerFrom.mockClear();
    mockInsertSingle.mockReset();
    mockDuplicateLookupSingle.mockReset();
    mockRequireInstallAuth.mockReset();
    mockRequireInstallAuth.mockResolvedValue({ installId: INSTALL_ID });
    mockScanSubmitRateLimit.mockReset();
    mockScanSubmitRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      reset: Date.now() + 60_000,
    });
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("accepts a valid submission from an authenticated install and returns 201", async () => {
    const createdAt = "2026-01-01T00:00:00.000Z";
    mockInsertSingle.mockResolvedValue({
      data: { id: "550e8400-e29b-41d4-a716-446655440000", created_at: createdAt },
      error: null,
    });

    const res = await postScan(VALID_SCAN_BODY);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      id: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: new Date(createdAt).getTime(),
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedRow = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow.owner_install_id).toBe(INSTALL_ID);
    expect(insertedRow.reported_isp).toBe("MTN Nigeria");
    expect(insertedRow.lat_encrypted).not.toBe(VALID_SCAN_BODY.lat);
  });

  it("defaults measurementMethod to 'heuristic' when omitted from the request body", async () => {
    mockInsertSingle.mockResolvedValue({
      data: { id: "550e8400-e29b-41d4-a716-446655440000", created_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    });

    expect("measurementMethod" in VALID_SCAN_BODY).toBe(false);
    const res = await postScan(VALID_SCAN_BODY);

    expect(res.status).toBe(201);
    const insertedRow = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow.measurement_method).toBe("heuristic");
  });

  it("returns 401 and never touches the database when the install token is missing or invalid", async () => {
    mockRequireInstallAuth.mockResolvedValue(unauthorizedResponse());

    const res = await postScan(VALID_SCAN_BODY);

    expect(res.status).toBe(401);
    expect(mockServerFrom).not.toHaveBeenCalled();
    expect(mockScanSubmitRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-install rate limit is exceeded, without touching the database", async () => {
    mockScanSubmitRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const res = await postScan(VALID_SCAN_BODY);

    expect(res.status).toBe(429);
    expect(mockServerFrom).not.toHaveBeenCalled();
  });

  it("rejects near-zero latency paired with nonzero throughput as an outlier, without touching the database", async () => {
    const res = await postScan({ ...VALID_SCAN_BODY, latencyMs: 0, downloadSpeed: 50 });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("outlier_rejected");
    expect(mockServerFrom).not.toHaveBeenCalled();
  });

  it("allows a reported 0ms latency when throughput is also 0 -- a plausible 'no connectivity' report", async () => {
    mockInsertSingle.mockResolvedValue({
      data: { id: "550e8400-e29b-41d4-a716-446655440000", created_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    });

    const res = await postScan({ ...VALID_SCAN_BODY, latencyMs: 0, downloadSpeed: 0, uploadSpeed: 0 });

    expect(res.status).toBe(201);
  });

  it("rejects a mobile scan reporting an implausibly high download speed", async () => {
    const res = await postScan({ ...VALID_SCAN_BODY, deviceType: "mobile", downloadSpeed: 5000 });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("outlier_rejected");
    expect(mockServerFrom).not.toHaveBeenCalled();
  });

  it("allows a non-mobile scan to report a speed above the mobile ceiling but below the non-mobile one", async () => {
    mockInsertSingle.mockResolvedValue({
      data: { id: "550e8400-e29b-41d4-a716-446655440000", created_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    });

    const res = await postScan({ ...VALID_SCAN_BODY, deviceType: "desktop", downloadSpeed: 1500 });

    expect(res.status).toBe(201);
  });

  it("treats a duplicate client-supplied id as success and returns the already-stored row, not a 500", async () => {
    const clientId = "550e8400-e29b-41d4-a716-446655440000";
    const existingCreatedAt = "2026-01-01T00:00:00.000Z";
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    mockDuplicateLookupSingle.mockResolvedValue({
      data: { id: clientId, created_at: existingCreatedAt },
      error: null,
    });

    const res = await postScan({ ...VALID_SCAN_BODY, id: clientId });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      id: clientId,
      timestamp: new Date(existingCreatedAt).getTime(),
    });
  });

  it("returns 500 via the shared error envelope on a genuine (non-duplicate) database error", async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "connection refused" },
    });

    const res = await postScan(VALID_SCAN_BODY);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("database_error");
  });

  it("appears in the served OpenAPI document", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, { post?: unknown }> };
    expect(doc.paths?.["/v1/scans"]?.post).toBeTruthy();
  });
});
