import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { convertIPv4ToBinary } from "hono/utils/ipaddr";

/**
 * Trusted-proxy-aware client IP resolution. Fixes the bug in plan §7.5 item
 * 5: the current `getClientIP` in apps/web/src/lib/rate-limit.ts reads
 * `request.ip`, which only Vercel populates, and falls back to the
 * `x-real-ip` header with no check on who set it — on any other host, or
 * from any direct caller, that header is just something the client typed.
 *
 * The rule: X-Forwarded-For is only trusted when it was actually appended by
 * a proxy we control. We know that by checking the TCP peer address (the
 * thing nothing except the network stack can forge) against an allowlist of
 * our own reverse proxy's addresses. If the peer isn't on that list — no
 * proxy configured, or a caller connecting directly — the header is ignored
 * outright and the raw peer address is used, so a client cannot claim a
 * fresher rate-limit identity just by sending its own X-Forwarded-For.
 *
 * IPv4 only. Deployment targets named in the plan (Fly.io, Railway, Render)
 * front traffic through IPv4 edge ranges; IPv6 trusted-proxy matching is not
 * implemented and TRUSTED_PROXIES entries containing ':' are ignored with a
 * warning rather than silently mismatching.
 */

interface Cidr {
  network: bigint;
  prefixLen: number;
}

function parseCidr(entry: string): Cidr | null {
  const [address, prefixLenStr] = entry.includes("/") ? entry.split("/") : [entry, "32"];
  const prefixLen = Number(prefixLenStr);

  if (address.includes(":")) {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ level: "warn", msg: "ignoring IPv6 TRUSTED_PROXIES entry", entry }));
    return null;
  }

  if (!Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;

  try {
    return { network: convertIPv4ToBinary(address), prefixLen };
  } catch {
    return null;
  }
}

function ipMatchesCidr(ip: string, cidr: Cidr): boolean {
  let ipBinary: bigint;
  try {
    ipBinary = convertIPv4ToBinary(ip);
  } catch {
    return false;
  }
  if (cidr.prefixLen === 0) return true;
  const mask = (0xffffffffn << BigInt(32 - cidr.prefixLen)) & 0xffffffffn;
  return (ipBinary & mask) === (cidr.network & mask);
}

/** Parses TRUSTED_PROXIES ("1.2.3.4,10.0.0.0/8") into matchable CIDRs. */
export function parseTrustedProxies(envValue: string | undefined): Cidr[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseCidr)
    .filter((c): c is Cidr => c !== null);
}

export function isTrustedProxy(ip: string, trusted: Cidr[]): boolean {
  return trusted.some((cidr) => ipMatchesCidr(ip, cidr));
}

/**
 * Pure resolution logic, kept separate from Hono/env access so it's testable
 * without mocking a Context or process.env.
 */
export function resolveClientIp(
  peerIp: string,
  xForwardedFor: string | undefined,
  trusted: Cidr[]
): string {
  if (!isTrustedProxy(peerIp, trusted)) {
    return peerIp;
  }

  if (!xForwardedFor) return peerIp;

  // XFF is a comma-separated chain, each hop appending the address it saw.
  // Walk from the right (most recently appended, i.e. closest to us) and
  // skip any entry that is itself one of our trusted proxies — the first
  // entry that ISN'T one of ours is the real client. If the whole chain is
  // our own proxies (shouldn't normally happen), fall back to the peer.
  const chain = xForwardedFor
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = chain.length - 1; i >= 0; i--) {
    if (!isTrustedProxy(chain[i], trusted)) {
      return chain[i];
    }
  }

  return peerIp;
}

/**
 * The Hono-context-reading wrapper used by actual routes/middleware.
 *
 * `getConnInfo` reads `c.env.incoming.socket.remoteAddress` and THROWS —
 * doesn't return undefined — when those bindings aren't present, which is
 * exactly what happens under `app.request()` in tests (no real Node server,
 * no real socket) and would happen on any non-Node runtime. Falling back to
 * "unknown" on that failure keeps parity with the literal fallback string
 * the code this replaces used, and — since "unknown" can never match a
 * configured trusted-proxy CIDR — safely disables the X-Forwarded-For trust
 * path too, rather than trusting a header with no verified peer behind it.
 */
export function getClientIP(c: Context): string {
  const trusted = parseTrustedProxies(process.env.TRUSTED_PROXIES);

  let peerIp = "unknown";
  try {
    peerIp = getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // No real socket available (test context, or a non-Node runtime).
  }

  const xForwardedFor = c.req.header("x-forwarded-for");
  return resolveClientIp(peerIp, xForwardedFor, trusted);
}
