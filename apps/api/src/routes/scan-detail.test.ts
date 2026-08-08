import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AuthenticatedInstall } from "../lib/auth.js";

const mockSingle = vi.fn();
const mockSupabaseConfigured = { value: true };

vi.mock("../lib/supabase.js", () => ({
  get supabase() {
    return mockSupabaseConfigured.value
      ? { from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }) }
      : null;
  },
  get isSupabaseConfigured() {
    return mockSupabaseConfigured.value;
  },
}));

const mockAuth: { value: AuthenticatedInstall | null } = { value: null };

vi.mock("../lib/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth.js")>();
  return {
    ...actual,
    resolveInstallAuth: () => Promise.resolve(mockAuth.value),
  };
});

import { app } from "../app.js";
import { encryptCoordinate } from "../lib/encryption.js";

const TEST_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_KEY = "311493eba94b1bf968f104172db5de55bd386dfe76acc39a654453a889759142";
const OWNER_INSTALL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_INSTALL_ID = "22222222-2222-4222-8222-222222222222";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_ID,
    lat_grid: 6.5266,
    lng_grid: 3.3775,
    reported_isp: "MTN Nigeria",
    verified_asn: null,
    latency_ms: 42,
    jitter: 5,
    upload_speed: "12.50",
    download_speed: "45.20",
    device_type: "mobile",
    measurement_method: "heuristic",
    created_at: "2026-01-01T00:00:00.000Z",
    owner_install_id: OWNER_INSTALL_ID,
    ...overrides,
  };
}

describe("GET /v1/scans/{id}", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    mockSupabaseConfigured.value = true;
    mockSingle.mockReset();
    mockAuth.value = null;
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("returns exact decrypted coordinates with isLocationExact: true for the owning install", async () => {
    mockAuth.value = { installId: OWNER_INSTALL_ID };
    const latEncrypted = await encryptCoordinate(6.52441234);
    const lngEncrypted = await encryptCoordinate(3.37921234);
    mockSingle.mockResolvedValue({
      data: baseRow({ lat_encrypted: latEncrypted, lng_encrypted: lngEncrypted }),
      error: null,
    });

    const res = await app.request(`/v1/scans/${TEST_ID}`, {
      headers: { Authorization: "Bearer owner-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lat).toBeCloseTo(6.52441234, 6);
    expect(body.lng).toBeCloseTo(3.37921234, 6);
    expect(body.isLocationExact).toBe(true);
  });

  it("falls back to grid coordinates with isLocationExact: false when the owning install's decryption fails", async () => {
    mockAuth.value = { installId: OWNER_INSTALL_ID };
    mockSingle.mockResolvedValue({
      data: baseRow({ lat_encrypted: "not-decryptable-garbage", lng_encrypted: "also-garbage" }),
      error: null,
    });

    const res = await app.request(`/v1/scans/${TEST_ID}`, {
      headers: { Authorization: "Bearer owner-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lat).toBe(6.5266); // lat_grid
    expect(body.lng).toBe(3.3775); // lng_grid
    expect(body.isLocationExact).toBe(false);
  });

  it("returns grid coordinates (not exact, not 403/404) for a different install's token", async () => {
    mockAuth.value = { installId: OTHER_INSTALL_ID };
    const latEncrypted = await encryptCoordinate(6.52441234);
    const lngEncrypted = await encryptCoordinate(3.37921234);
    mockSingle.mockResolvedValue({
      data: baseRow({ lat_encrypted: latEncrypted, lng_encrypted: lngEncrypted }),
      error: null,
    });

    const res = await app.request(`/v1/scans/${TEST_ID}`, {
      headers: { Authorization: "Bearer some-other-install-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lat).toBe(6.5266); // lat_grid, not the decrypted exact value
    expect(body.lng).toBe(3.3775); // lng_grid, not the decrypted exact value
    expect(body.isLocationExact).toBe(false);
  });

  it("returns grid coordinates for an unauthenticated caller (no token), same as a non-owner", async () => {
    mockAuth.value = null;
    const latEncrypted = await encryptCoordinate(6.52441234);
    const lngEncrypted = await encryptCoordinate(3.37921234);
    mockSingle.mockResolvedValue({
      data: baseRow({ lat_encrypted: latEncrypted, lng_encrypted: lngEncrypted }),
      error: null,
    });

    const res = await app.request(`/v1/scans/${TEST_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lat).toBe(6.5266);
    expect(body.lng).toBe(3.3775);
    expect(body.isLocationExact).toBe(false);
  });

  it("returns grid coordinates for a row with owner_install_id: null, even if an authenticated caller's id would otherwise coincidentally match", async () => {
    // A row with no recorded owner can never be "owned" by anyone, no
    // matter whose token is presented -- prove this explicitly rather than
    // trusting it by construction. If the comparison were sloppy (e.g.
    // both sides falsy/undefined), this would wrongly leak exact coords.
    mockAuth.value = { installId: OWNER_INSTALL_ID };
    const latEncrypted = await encryptCoordinate(6.52441234);
    const lngEncrypted = await encryptCoordinate(3.37921234);
    mockSingle.mockResolvedValue({
      data: baseRow({ lat_encrypted: latEncrypted, lng_encrypted: lngEncrypted, owner_install_id: null }),
      error: null,
    });

    const res = await app.request(`/v1/scans/${TEST_ID}`, {
      headers: { Authorization: "Bearer owner-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lat).toBe(6.5266);
    expect(body.lng).toBe(3.3775);
    expect(body.isLocationExact).toBe(false);
  });

  it("rejects a non-UUID id without querying the database", async () => {
    const res = await app.request("/v1/scans/not-a-uuid");
    expect(res.status).toBe(400);
    expect(mockSingle).not.toHaveBeenCalled();
  });

  it("returns 404 when the row doesn't exist", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "no rows" } });
    const res = await app.request(`/v1/scans/${TEST_ID}`);
    expect(res.status).toBe(404);
  });

  it("returns 503 when Supabase isn't configured, not a 200 or an empty result", async () => {
    mockSupabaseConfigured.value = false;
    const res = await app.request(`/v1/scans/${TEST_ID}`);
    expect(res.status).toBe(503);
  });

  it("returns 500 when a stored row's ISP no longer matches the canonical list", async () => {
    const latEncrypted = await encryptCoordinate(6.5);
    const lngEncrypted = await encryptCoordinate(3.3);
    mockSingle.mockResolvedValue({
      data: baseRow({
        lat_encrypted: latEncrypted,
        lng_encrypted: lngEncrypted,
        reported_isp: "Some Long-Defunct ISP",
      }),
      error: null,
    });

    const res = await app.request(`/v1/scans/${TEST_ID}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: {
        code: "data_integrity_error",
        message: "This scan's stored data doesn't match the expected shape",
      },
    });
  });

  it("appears in the served OpenAPI document", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(doc.paths ?? {})).toContain("/v1/scans/{id}");
  });
});
