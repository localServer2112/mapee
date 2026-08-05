import { describe, it, expect } from "vitest";
import { parseTrustedProxies, isTrustedProxy, resolveClientIp } from "./client-ip";

describe("parseTrustedProxies", () => {
  it("parses a bare IP as a /32", () => {
    const trusted = parseTrustedProxies("10.0.0.5");
    expect(isTrustedProxy("10.0.0.5", trusted)).toBe(true);
    expect(isTrustedProxy("10.0.0.6", trusted)).toBe(false);
  });

  it("parses a CIDR range", () => {
    const trusted = parseTrustedProxies("10.0.0.0/8");
    expect(isTrustedProxy("10.255.255.255", trusted)).toBe(true);
    expect(isTrustedProxy("11.0.0.0", trusted)).toBe(false);
  });

  it("parses multiple comma-separated entries", () => {
    const trusted = parseTrustedProxies("10.0.0.5, 172.16.0.0/12");
    expect(isTrustedProxy("10.0.0.5", trusted)).toBe(true);
    expect(isTrustedProxy("172.20.1.1", trusted)).toBe(true);
    expect(isTrustedProxy("8.8.8.8", trusted)).toBe(false);
  });

  it("returns an empty list for unset config, not a permissive default", () => {
    // Absence must mean "trust nothing", not "trust everything" — the
    // opposite default would make the whole feature a no-op by accident.
    expect(parseTrustedProxies(undefined)).toEqual([]);
    expect(parseTrustedProxies("")).toEqual([]);
  });

  it("ignores an IPv6 entry rather than mismatching silently", () => {
    const trusted = parseTrustedProxies("::1,10.0.0.5");
    expect(trusted).toHaveLength(1);
    expect(isTrustedProxy("10.0.0.5", trusted)).toBe(true);
  });

  it("ignores a malformed entry rather than throwing", () => {
    expect(() => parseTrustedProxies("not-an-ip,10.0.0.5")).not.toThrow();
    expect(parseTrustedProxies("not-an-ip,10.0.0.5")).toHaveLength(1);
  });
});

describe("resolveClientIp — the anti-spoofing guarantee", () => {
  const NO_TRUSTED_PROXIES = parseTrustedProxies(undefined);
  const NGINX = parseTrustedProxies("10.0.0.1");

  it("ignores X-Forwarded-For entirely when no proxy is trusted", () => {
    // This is the exact bug being fixed: a direct, untrusted caller sending
    // its own X-Forwarded-For must not be able to claim a different identity.
    const spoofed = resolveClientIp("203.0.113.9", "1.2.3.4", NO_TRUSTED_PROXIES);
    expect(spoofed).toBe("203.0.113.9");
  });

  it("ignores X-Forwarded-For when the peer is not on the trusted list", () => {
    // An attacker connecting directly (not through our real proxy) sets XFF
    // to whatever they like. Peer address, not the header, must win.
    const spoofed = resolveClientIp("198.51.100.1", "9.9.9.9", NGINX);
    expect(spoofed).toBe("198.51.100.1");
  });

  it("trusts X-Forwarded-For's client IP when the peer IS a configured proxy", () => {
    const real = resolveClientIp("10.0.0.1", "203.0.113.9", NGINX);
    expect(real).toBe("203.0.113.9");
  });

  it("walks a multi-hop chain to the first entry that isn't one of our proxies", () => {
    const twoProxies = parseTrustedProxies("10.0.0.1,10.0.0.2");
    // Real client, then our first proxy, then our second (closest) proxy.
    const real = resolveClientIp("10.0.0.2", "203.0.113.9, 10.0.0.1", twoProxies);
    expect(real).toBe("203.0.113.9");
  });

  it("falls back to the peer address if XFF is absent despite a trusted peer", () => {
    expect(resolveClientIp("10.0.0.1", undefined, NGINX)).toBe("10.0.0.1");
  });

  it("falls back to the peer address if the entire XFF chain is our own proxies", () => {
    const real = resolveClientIp("10.0.0.1", "10.0.0.1", NGINX);
    expect(real).toBe("10.0.0.1");
  });
});
