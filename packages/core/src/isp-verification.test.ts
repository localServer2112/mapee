import { describe, it, expect } from "vitest";
import { detectISP } from "./isp-verification";
import type { ASNInfo } from "./types";

function asn(overrides: Partial<ASNInfo> = {}): ASNInfo {
  return { isp: "", as: "", asname: "", org: "", ...overrides };
}

describe("detectISP", () => {
  it("returns null when nothing matches", () => {
    expect(detectISP(asn({ isp: "Comcast Cable" }))).toBeNull();
  });

  it("returns null for entirely empty ASN info", () => {
    expect(detectISP(asn())).toBeNull();
  });

  it("matches the major Nigerian carriers", () => {
    expect(detectISP(asn({ isp: "MTN Nigeria Communications" }))).toBe("MTN Nigeria");
    expect(detectISP(asn({ isp: "Airtel Networks Limited" }))).toBe("Airtel Nigeria");
    expect(detectISP(asn({ isp: "Globacom Limited" }))).toBe("Globacom (Glo)");
    expect(detectISP(asn({ isp: "Spectranet Ltd" }))).toBe("Spectranet");
  });

  it("normalises case, spacing and punctuation before matching", () => {
    expect(detectISP(asn({ isp: "m.t.n  NIGERIA" }))).toBe("MTN Nigeria");
    expect(detectISP(asn({ org: "S P E C T R A N E T" }))).toBe("Spectranet");
  });

  it("maps 9mobile's legacy and corporate names", () => {
    expect(detectISP(asn({ isp: "Etisalat Nigeria" }))).toBe("9mobile");
    expect(detectISP(asn({ isp: "EMTS Limited" }))).toBe("9mobile");
    expect(detectISP(asn({ isp: "9Mobile" }))).toBe("9mobile");
  });

  it("maps Starlink via its operating company", () => {
    expect(detectISP(asn({ org: "SpaceX Services, Inc." }))).toBe("Starlink Nigeria");
    expect(detectISP(asn({ isp: "Starlink" }))).toBe("Starlink Nigeria");
  });

  it("searches org and asname, not just isp", () => {
    expect(detectISP(asn({ org: "Globacom Limited" }))).toBe("Globacom (Glo)");
    expect(detectISP(asn({ asname: "TIZETI-NETWORK" }))).toBe("Tizeti (wifi.com.ng)");
  });

  it("matches Tizeti by its consumer-facing domain", () => {
    // The pattern contains dots, which normalisation strips from the haystack —
    // this asserts the domain form still resolves.
    expect(detectISP(asn({ isp: "wifi.com.ng" }))).toBe("Tizeti (wifi.com.ng)");
  });

  it("ignores undefined-ish fields without throwing", () => {
    const partial = { isp: "MTN", as: undefined, asname: undefined, org: undefined };
    expect(detectISP(partial as unknown as ASNInfo)).toBe("MTN Nigeria");
  });
});
