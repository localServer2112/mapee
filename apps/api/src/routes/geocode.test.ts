import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { app } from "../app";

// Mocking global fetch rather than hitting real Nominatim in the test suite —
// this route was verified against the live API by hand during development
// (real Lagos query, cache MISS then HIT, rate-limit header decrementing),
// but a test suite that depends on a third party's network and courtesy rate
// limit is not something CI should rely on being up.
const NOMINATIM_FIXTURE = [
  {
    display_name: "Lagos, Lagos Island, Lagos, 100242, Nigeria",
    lat: "6.4550575",
    lon: "3.3941795",
    boundingbox: ["6.2950575", "6.6150575", "3.2341795", "3.5541795"],
  },
];

describe("GET /v1/geocode", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(NOMINATIM_FIXTURE), { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("transforms a Nominatim result into our GeocodeResult shape", async () => {
    const res = await app.request("/v1/geocode?q=Lagos");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        displayName: "Lagos, Lagos Island, Lagos, 100242, Nigeria",
        lat: 6.4550575,
        lng: 3.3941795,
        boundingBox: [6.2950575, 6.6150575, 3.2341795, 3.5541795],
      },
    ]);
  });

  it("passes country through to Nominatim as countrycodes", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    await app.request("/v1/geocode?q=Lagos&country=ng");
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("countrycodes=ng");
  });

  it("rejects a query under 2 characters without calling upstream", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const res = await app.request("/v1/geocode?q=a");
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-padded query that trims below 2 characters", async () => {
    const res = await app.request(`/v1/geocode?q=${encodeURIComponent("  a")}`);
    expect(res.status).toBe(400);
  });

  it("returns 500 via the shared error envelope when Nominatim fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    // A cache key no other test in this file touches — reusing "Lagos" here
    // would silently hit the entry test 1 already cached and never call the
    // mocked fetch at all, passing without exercising anything.
    const res = await app.request("/v1/geocode?q=NominatimFailureTestQuery");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "upstream_error", message: "Failed to geocode location" },
    });
  });

  it("drops a malformed individual result instead of failing the whole request", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            ...NOMINATIM_FIXTURE,
            { display_name: "Bad Row", lat: "not-a-number", lon: "3.0" },
          ]),
          { status: 200 }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    // Same cache-key-collision concern as the 500 test above — must be a
    // query no earlier test has cached, or this "passes" by returning a
    // stale cached result without the mocked fetch ever running.
    const res = await app.request("/v1/geocode?q=MalformedResultTestQuery");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ displayName: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].displayName).toBe("Lagos, Lagos Island, Lagos, 100242, Nigeria");
  });

  it("caches a result and serves the second identical request from cache", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const first = await app.request("/v1/geocode?q=UniqueCacheTestQuery");
    expect(first.headers.get("x-cache")).toBe("MISS");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await app.request("/v1/geocode?q=UniqueCacheTestQuery");
    expect(second.headers.get("x-cache")).toBe("HIT");
    // Still 1 — the second request must not have gone to Nominatim again.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("decrements X-RateLimit-Remaining across requests", async () => {
    const first = await app.request("/v1/geocode?q=RateLimitTestA");
    const second = await app.request("/v1/geocode?q=RateLimitTestB");
    const remainingFirst = Number(first.headers.get("x-ratelimit-remaining"));
    const remainingSecond = Number(second.headers.get("x-ratelimit-remaining"));
    expect(remainingSecond).toBe(remainingFirst - 1);
  });

  it("appears in the served OpenAPI document with a 500 response declared", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const responses = doc.paths["/v1/geocode"].get.responses;
    expect(Object.keys(responses).sort()).toEqual(["200", "400", "429", "500"]);
  });
});
