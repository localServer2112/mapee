import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";

const mockOrder = vi.fn();
const mockDeleteSelect = vi.fn();
const mockFrom = vi.fn();
const mockServerClientConfigured = { value: true };

vi.mock("../lib/supabase.js", () => ({
  createServerClient: () =>
    mockServerClientConfigured.value
      ? {
          from: mockFrom,
        }
      : null,
}));

const mockRequireInstallAuth = vi.fn();

vi.mock("../lib/auth.js", () => ({
  requireInstallAuth: (...args: unknown[]) => mockRequireInstallAuth(...args),
}));

import { meScans } from "./me-scans.js";
import { errorEnvelope } from "../lib/errors.js";
import { encryptCoordinate } from "../lib/encryption.js";

// The route file is mounted standalone here rather than pulled in through
// app.js -- app.js is a later integration step another agent owns, so this
// keeps the test self-contained against exactly what this file exports.
const app = new OpenAPIHono();
app.route("/", meScans);
app.notFound((c) => c.json(errorEnvelope("not_found", "No route matches this path"), 404));

const INSTALL_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_KEY = "311493eba94b1bf968f104172db5de55bd386dfe76acc39a654453a889759142";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
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
    ...overrides,
  };
}

function authHeaders(token = "some-token") {
  return { authorization: `Bearer ${token}` };
}

describe("/v1/me/scans", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    mockServerClientConfigured.value = true;
    mockOrder.mockReset();
    mockDeleteSelect.mockReset();
    mockFrom.mockReset();
    mockRequireInstallAuth.mockReset();
    mockRequireInstallAuth.mockResolvedValue({ installId: INSTALL_ID });
    process.env.ENCRYPTION_KEY = TEST_KEY;

    // Wires up the two independent query shapes GET and DELETE build off
    // `.from("ping_logs")`: GET chains select().eq().order(), DELETE chains
    // delete().eq().select().
    const mockSelectEq = vi.fn(() => ({ order: mockOrder }));
    const mockDeleteEq = vi.fn(() => ({ select: mockDeleteSelect }));
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: mockSelectEq }),
      delete: () => ({ eq: mockDeleteEq }),
    }));
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  describe("GET", () => {
    it("returns exact decrypted coordinates for the authenticated install's own scans", async () => {
      const latEncrypted = await encryptCoordinate(6.52441234);
      const lngEncrypted = await encryptCoordinate(3.37921234);
      mockOrder.mockResolvedValue({
        data: [baseRow({ lat_encrypted: latEncrypted, lng_encrypted: lngEncrypted })],
        error: null,
      });

      const res = await app.request("/v1/me/scans", { headers: authHeaders() });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<Record<string, unknown>>;
      expect(body).toHaveLength(1);
      expect(body[0].lat).toBeCloseTo(6.52441234, 6);
      expect(body[0].lng).toBeCloseTo(3.37921234, 6);
      expect(body[0].isLocationExact).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("ping_logs");
    });

    it("falls back to grid coordinates with isLocationExact: false when decryption fails", async () => {
      mockOrder.mockResolvedValue({
        data: [baseRow({ lat_encrypted: "not-decryptable-garbage", lng_encrypted: "also-garbage" })],
        error: null,
      });

      const res = await app.request("/v1/me/scans", { headers: authHeaders() });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<Record<string, unknown>>;
      expect(body[0].lat).toBe(6.5266);
      expect(body[0].lng).toBe(3.3775);
      expect(body[0].isLocationExact).toBe(false);
    });

    it("returns an empty array, not an error, when the install has no scans", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });

      const res = await app.request("/v1/me/scans", { headers: authHeaders() });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("drops a malformed row rather than failing the whole request", async () => {
      const latEncrypted = await encryptCoordinate(6.5);
      const lngEncrypted = await encryptCoordinate(3.3);
      mockOrder.mockResolvedValue({
        data: [
          baseRow({ lat_encrypted: latEncrypted, lng_encrypted: lngEncrypted }),
          baseRow({
            id: "660e8400-e29b-41d4-a716-446655440001",
            lat_encrypted: latEncrypted,
            lng_encrypted: lngEncrypted,
            reported_isp: "Some Long-Defunct ISP",
          }),
        ],
        error: null,
      });

      const res = await app.request("/v1/me/scans", { headers: authHeaders() });
      expect(res.status).toBe(200);
      const body = (await res.json()) as unknown[];
      expect(body).toHaveLength(1);
    });

    it("returns 401 and never queries the database when the install token doesn't resolve", async () => {
      mockRequireInstallAuth.mockResolvedValue(
        new Response(JSON.stringify(errorEnvelope("unauthorized", "Missing or invalid install token")), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await app.request("/v1/me/scans", { headers: authHeaders("bad-token") });
      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("deletes every row owned by the authenticated install and returns the real count", async () => {
      mockDeleteSelect.mockResolvedValue({
        data: [{ id: "a" }, { id: "b" }, { id: "c" }],
        error: null,
      });

      const res = await app.request("/v1/me/scans", { method: "DELETE", headers: authHeaders() });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deletedCount: 3 });
      expect(mockFrom).toHaveBeenCalledWith("ping_logs");
    });

    it("returns deletedCount: 0, not an error, when the install has zero scans", async () => {
      mockDeleteSelect.mockResolvedValue({ data: [], error: null });

      const res = await app.request("/v1/me/scans", { method: "DELETE", headers: authHeaders() });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deletedCount: 0 });
    });

    it("returns 401 and never calls the database when the install token doesn't resolve", async () => {
      mockRequireInstallAuth.mockResolvedValue(
        new Response(JSON.stringify(errorEnvelope("unauthorized", "Missing or invalid install token")), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await app.request("/v1/me/scans", { method: "DELETE", headers: authHeaders("bad-token") });
      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
