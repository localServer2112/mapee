import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { app } from "../app.js";

const OPENCELLID_FIXTURE = {
  cells: [
    { cellid: 12345, lat: 6.5244, lon: 3.3792, mcc: 621, mnc: 30, lac: 1, radio: "LTE" },
    { cellid: 67890, lat: 6.53, lon: 3.38, mcc: 621, mnc: 30, lac: 1, radio: "NR" },
  ],
};

describe("GET /v1/towers", () => {
  const originalKey = process.env.OPENCELLID_API_KEY;

  beforeEach(() => {
    process.env.OPENCELLID_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(OPENCELLID_FIXTURE), { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.OPENCELLID_API_KEY = originalKey;
  });

  it("transforms OpenCelliD cells into CellTower shape, deriving 4G/5G from radio type", async () => {
    const res = await app.request(
      "/v1/towers?bbox=6.52,3.37,6.53,3.38"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      { id: "621-30-1-12345", lat: 6.5244, lng: 3.3792, type: "4G", mcc: 621, mnc: 30, lac: 1, cellId: 12345 },
      { id: "621-30-1-67890", lat: 6.53, lng: 3.38, type: "5G", mcc: 621, mnc: 30, lac: 1, cellId: 67890 },
    ]);
  });

  it("returns 503 without calling upstream when OPENCELLID_API_KEY is unset", async () => {
    delete process.env.OPENCELLID_API_KEY;
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await app.request("/v1/towers?bbox=6.52,3.37,6.53,3.38");
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats OpenCelliD's 'No cells found' as a valid empty result, not an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "No cells found" }), { status: 200 }))
    );
    const res = await app.request("/v1/towers?bbox=1.1,1.1,1.2,1.2");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 502 for a genuine OpenCelliD error payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "invalid token" }), { status: 200 }))
    );
    const res = await app.request("/v1/towers?bbox=2.1,2.1,2.2,2.2");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: { code: "upstream_error", message: "invalid token" } });
  });

  it("returns 502 when OpenCelliD's HTTP response itself is non-OK", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const res = await app.request("/v1/towers?bbox=3.1,3.1,3.2,3.2");
    expect(res.status).toBe(502);
  });

  it("drops a malformed individual tower rather than failing the whole request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              cells: [
                ...OPENCELLID_FIXTURE.cells,
                { cellid: 1, lat: "not-a-number", lon: 3, mcc: 1, mnc: 1, lac: 1, radio: "LTE" },
              ],
            }),
            { status: 200 }
          )
      )
    );
    const res = await app.request("/v1/towers?bbox=4.1,4.1,4.2,4.2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it("caches a result and serves the second identical request from cache", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const first = await app.request("/v1/towers?bbox=9.1,9.1,9.2,9.2");
    expect(first.headers.get("x-cache")).toBe("MISS");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await app.request("/v1/towers?bbox=9.1,9.1,9.2,9.2");
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a bodyless 304 on a repeat request with a matching If-None-Match", async () => {
    const first = await app.request("/v1/towers?bbox=7.1,7.1,7.2,7.2");
    const etag = first.headers.get("etag")!;
    expect(etag).toBeTruthy();

    const second = await app.request("/v1/towers?bbox=7.1,7.1,7.2,7.2", {
      headers: { "If-None-Match": etag },
    });
    expect(second.status).toBe(304);
  });

  it("is actually rate limited — apiRateLimits.towers is applied, unlike the legacy route", async () => {
    const res = await app.request("/v1/towers?bbox=6.52,3.37,6.53,3.38");
    expect(res.headers.get("x-ratelimit-remaining")).not.toBeNull();
  });

  it("appears in the served OpenAPI document", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(doc.paths ?? {})).toContain("/v1/towers");
  });
});
