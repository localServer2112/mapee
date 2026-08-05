import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Under app.request() there's no real socket, so getClientIP's own
// try/catch around getConnInfo always falls back to "unknown" — which
// would short-circuit this route to its all-Unknown response before ever
// reaching the WHOIS/GeoIP logic. Mocking the module lets each test control
// what IP the route believes it's identifying, the same way geocode.test.ts
// mocks global fetch to control what Nominatim "returns".
vi.mock("../lib/client-ip.js", () => ({
  getClientIP: vi.fn(),
}));

vi.mock("whoiser", () => ({
  whoisIp: vi.fn(),
}));

import { app } from "../app.js";
import { getClientIP } from "../lib/client-ip.js";
import { whoisIp } from "whoiser";

const mockGetClientIP = getClientIP as unknown as ReturnType<typeof vi.fn>;
const mockWhoisIp = whoisIp as unknown as ReturnType<typeof vi.fn>;

describe("GET /v1/network/identify", () => {
  beforeEach(() => {
    mockGetClientIP.mockReset();
    mockWhoisIp.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the all-Unknown shape without calling WHOIS/GeoIP when the IP can't be resolved", async () => {
    mockGetClientIP.mockReturnValue("unknown");
    const res = await app.request("/v1/network/identify");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isp: "Unknown", as: "", asname: "", org: "Unknown" });
    expect(mockWhoisIp).not.toHaveBeenCalled();
  });

  it("merges WHOIS (network identity) over GeoIP (fallback), preferring WHOIS's NetName", async () => {
    mockGetClientIP.mockReturnValue("197.210.0.1");
    mockWhoisIp.mockResolvedValue({
      "whois.afrinic.net": { NetName: "MTN-NG", Organization: "MTN Nigeria Communications" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ isp: "MTN NG GeoIP", as: "AS29465" }), { status: 200 }))
    );

    const res = await app.request("/v1/network/identify");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      isp: "MTN-NG",
      as: "AS29465",
      asname: "MTN-NG",
      org: "MTN Nigeria Communications",
    });
  });

  it("falls back to GeoIP's isp/org when WHOIS fails or returns nothing usable", async () => {
    mockGetClientIP.mockReturnValue("197.210.0.2");
    mockWhoisIp.mockRejectedValue(new Error("whois server unreachable"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ isp: "Airtel NG", org: "Airtel Networks" }), { status: 200 }))
    );

    const res = await app.request("/v1/network/identify");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      isp: "Airtel NG",
      as: "",
      asname: "Airtel NG",
      org: "Airtel Networks",
    });
  });

  it("returns the all-Unknown shape, not an error, when both lookups fail", async () => {
    mockGetClientIP.mockReturnValue("197.210.0.3");
    mockWhoisIp.mockRejectedValue(new Error("whois down"));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("geoip down"); }));

    const res = await app.request("/v1/network/identify");
    expect(res.status).toBe(200);
    // asname mirrors isp's default ("Unknown"), not a separately-empty
    // field — same as the legacy route's `asname: networkName`.
    expect(await res.json()).toEqual({ isp: "Unknown", as: "", asname: "Unknown", org: "Unknown" });
  });

  it("substitutes the dev fallback IP for loopback, not the literal 127.0.0.1", async () => {
    mockGetClientIP.mockReturnValue("127.0.0.1");
    mockWhoisIp.mockResolvedValue({});
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await app.request("/v1/network/identify");
    expect(mockWhoisIp).toHaveBeenCalledWith("105.112.96.1");
    expect(String(fetchMock.mock.calls[0][0])).toContain("105.112.96.1");
  });

  it("caches a result and serves the second identical request from cache", async () => {
    mockGetClientIP.mockReturnValue("197.210.0.9");
    mockWhoisIp.mockResolvedValue({});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ isp: "Test ISP" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await app.request("/v1/network/identify");
    expect(first.headers.get("x-cache")).toBe("MISS");
    expect(mockWhoisIp).toHaveBeenCalledTimes(1);

    const second = await app.request("/v1/network/identify");
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(mockWhoisIp).toHaveBeenCalledTimes(1);
  });

  it("appears in the served OpenAPI document", async () => {
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(doc.paths ?? {})).toContain("/v1/network/identify");
  });
});
