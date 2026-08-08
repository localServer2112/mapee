import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashInstallToken } from "../lib/auth.js";

const mockSingle = vi.fn();
const mockInsertPayloads: Record<string, unknown>[] = [];
const mockFromTables: string[] = [];
const mockConfigured = { value: true };

function insertImpl(payload: Record<string, unknown>) {
  mockInsertPayloads.push(payload);
  return { select: () => ({ single: mockSingle }) };
}

vi.mock("../lib/supabase.js", () => ({
  createServerClient: () => {
    if (!mockConfigured.value) return null;
    return {
      from: (table: string) => {
        mockFromTables.push(table);
        return { insert: insertImpl };
      },
    };
  },
}));

const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));

vi.mock("../lib/rate-limit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/rate-limit.js")>();
  return {
    ...actual,
    apiRateLimits: { ...actual.apiRateLimits, installs: mockRateLimit },
  };
});

import { installs } from "./installs.js";

const VALID_ROW = { id: "550e8400-e29b-41d4-a716-446655440000" };

function postInstall(body: unknown) {
  return installs.request("/v1/installs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/installs", () => {
  beforeEach(() => {
    mockConfigured.value = true;
    mockSingle.mockReset();
    mockInsertPayloads.length = 0;
    mockFromTables.length = 0;
    mockRateLimit.mockReset();
    mockRateLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });
    mockSingle.mockResolvedValue({ data: VALID_ROW, error: null });
  });

  for (const platform of ["ios", "android", "web"] as const) {
    it(`registers a ${platform} install and returns 201 with an id and a plausible token`, async () => {
      const res = await postInstall({ platform });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; token: string };
      expect(body.id).toBe(VALID_ROW.id);
      // generateInstallToken() is randomBytes(32).toString("hex") — 64 hex chars.
      expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    });
  }

  it("rejects an invalid platform value with 400 at the schema layer", async () => {
    const res = await postInstall({ platform: "windows" });
    expect(res.status).toBe(400);
    expect(mockSingle).not.toHaveBeenCalled();
  });

  it("stores only the hash of the token, never the raw token, and the hash actually reproduces", async () => {
    const res = await postInstall({ platform: "web" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; token: string };

    expect(mockFromTables).toContain("installs");
    expect(mockInsertPayloads).toHaveLength(1);
    const stored = mockInsertPayloads[0];

    expect(stored.platform).toBe("web");
    expect(typeof stored.token_hash).toBe("string");
    // The critical property: what's persisted is not the returned token...
    expect(stored.token_hash).not.toBe(body.token);
    // ...but it IS that token's SHA-256 hash, reproducible with the same
    // algorithm the auth layer uses to verify tokens on later requests. A
    // bug here means either raw tokens at rest, or a hash mismatch that
    // locks every install out immediately.
    expect(stored.token_hash).toBe(hashInstallToken(body.token));
  });

  it("returns 500 via the shared error envelope on a database error, without leaking the raw error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "connection refused: password authentication failed" } });
    const res = await postInstall({ platform: "ios" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "database_error", message: "Failed to register install" },
    });
    expect(JSON.stringify(body)).not.toContain("connection refused");
  });

  it("returns 429 when the rate limit is exceeded, without touching the database", async () => {
    const reset = Date.now() + 30_000;
    mockRateLimit.mockResolvedValue({ success: false, remaining: 0, reset });
    const res = await postInstall({ platform: "android" });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toEqual({
      error: {
        code: "rate_limited",
        message: "Rate limit exceeded. Please try again later.",
        details: { retryAfter: expect.any(Number) },
      },
    });
    expect(mockSingle).not.toHaveBeenCalled();
  });
});
