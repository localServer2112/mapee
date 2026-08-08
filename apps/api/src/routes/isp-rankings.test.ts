import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockSupabaseConfigured = { value: true };

vi.mock("../lib/supabase.js", () => ({
  get supabase() {
    return mockSupabaseConfigured.value
      ? { from: () => ({ select: () => ({ limit: mockSelect }) }) }
      : null;
  },
  get isSupabaseConfigured() {
    return mockSupabaseConfigured.value;
  },
}));

import { app } from "../app.js";

const RANKING_FIXTURE = [
  {
    isp: "MTN Nigeria",
    avg_latency: 68,
    median_latency: 60,
    avg_jitter: 8,
    sample_count: 214,
    avg_download: "32.10", // Postgres DECIMAL columns come back as strings
    avg_upload: "9.40",
  },
];

describe("GET /v1/isp-rankings", () => {
  beforeEach(() => {
    mockSupabaseConfigured.value = true;
    mockSelect.mockReset();
  });

  it("normalises the isp_rankings view's snake_case row into camelCase, converting DECIMAL strings to numbers", async () => {
    mockSelect.mockResolvedValue({ data: RANKING_FIXTURE, error: null });
    const res = await app.request("/v1/isp-rankings");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        isp: "MTN Nigeria",
        avgLatency: 68,
        medianLatency: 60,
        avgJitter: 8,
        sampleCount: 214,
        avgDownload: 32.1,
        avgUpload: 9.4,
      },
    ]);
  });

  it("returns 200 with an empty array when Supabase isn't configured, not an error", async () => {
    mockSupabaseConfigured.value = false;
    const res = await app.request("/v1/isp-rankings");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(res.headers.get("x-database-status")).toBe("not-configured");
  });

  it("returns 500 via the shared error envelope on a database error", async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const res = await app.request("/v1/isp-rankings");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "database_error", message: "Failed to fetch ISP rankings" },
    });
  });

  it("drops a row for an ISP outside the canonical list rather than failing the whole request", async () => {
    mockSelect.mockResolvedValue({
      data: [...RANKING_FIXTURE, { ...RANKING_FIXTURE[0], isp: "Some Unlisted ISP" }],
      error: null,
    });
    const res = await app.request("/v1/isp-rankings");
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
  });

  it("appears in the served OpenAPI document", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(doc.paths ?? {})).toContain("/v1/isp-rankings");
  });
});
