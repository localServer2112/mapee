import { OpenAPIHono } from "@hono/zod-openapi";
import { whoisIp } from "whoiser";
import { getNetworkIdentifyRoute, type NetworkIdentify } from "@mapee/contracts";
import { validationErrorHook } from "../lib/errors.js";
import { apiRateLimits, rateLimitResponse } from "../lib/rate-limit.js";
import { redis } from "../lib/redis.js";
import { getClientIP } from "../lib/client-ip.js";

/**
 * Ported from apps/web/src/app/api/asn/route.ts. Same WHOIS + GeoIP dual
 * lookup. Two real changes:
 *
 * 1. Client IP now comes from the trusted-proxy-aware getClientIP
 *    (lib/client-ip.ts) instead of `request.ip || x-real-ip`. This route's
 *    whole job is identifying the caller's own network from their IP, so
 *    getting that IP from a header nobody's verified the sender for is a
 *    worse version of the same bug already fixed for rate-limit identity.
 * 2. The dev-localhost fallback is narrowed. The legacy route falls back to
 *    a hardcoded MTN Nigeria IP whenever clientIp is falsy OR literally
 *    loopback -- plan §9 flags this as "the fallback is unconditional on
 *    any unresolvable IP", which matters here specifically because
 *    getClientIP's own failure sentinel is the string "unknown", not an
 *    empty value, so a literal port would only ever hit the mock-IP path
 *    for loopback and would fall through to a real (and real-looking, but
 *    silently wrong) WHOIS/GeoIP lookup for "unknown" instead. Fixed by
 *    checking for loopback specifically, and returning the honest all-Unknown
 *    shape for a truly unresolvable IP rather than pretending it's a Nigerian
 *    test address.
 */
export const networkIdentify = new OpenAPIHono({ defaultHook: validationErrorHook });

const IP_API_URL = "http://ip-api.com/json";
const DEV_FALLBACK_IP = "105.112.96.1"; // MTN Nigeria, for local WHOIS/GeoIP testing only

interface NetworkIdentifyCacheEntry {
  data: NetworkIdentify;
  timestamp: number;
}

const identifyCache = new Map<string, NetworkIdentifyCacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function isLoopback(ip: string): boolean {
  return ip === "::1" || ip === "127.0.0.1";
}

networkIdentify.openapi(getNetworkIdentifyRoute, async (c) => {
  const rateLimitResult = await apiRateLimits.networkIdentify(c);
  if (!rateLimitResult.success) {
    return rateLimitResponse(c, rateLimitResult.reset);
  }

  const resolvedIp = getClientIP(c);
  const unresolvable = resolvedIp === "unknown";
  const lookupIp = isLoopback(resolvedIp) ? DEV_FALLBACK_IP : resolvedIp;

  if (unresolvable) {
    const unknown: NetworkIdentify = { isp: "Unknown", as: "", asname: "", org: "Unknown" };
    return c.json(unknown, 200, { "Cache-Control": "no-store, max-age=0" });
  }

  const cacheKey = `networkIdentify:${lookupIp}`;
  let cached: NetworkIdentify | null = null;
  try {
    if (redis) {
      cached = await redis.get<NetworkIdentify>(cacheKey);
    } else {
      const entry = identifyCache.get(cacheKey);
      if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        cached = entry.data;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "network-identify cache read failed", err: String(e) }));
  }

  if (cached) {
    return c.json(cached, 200, {
      "Cache-Control": "no-store, max-age=0",
      "X-Cache": "HIT",
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
    });
  }

  const [whoisResult, geoResult] = await Promise.allSettled([
    whoisIp(lookupIp),
    fetch(`${IP_API_URL}/${lookupIp}`).then((res) => res.json()),
  ]);

  const geoData =
    geoResult.status === "fulfilled"
      ? (geoResult.value as { isp?: string; org?: string; as?: string })
      : {};

  let networkName = geoData.isp || "Unknown";
  let orgName = geoData.org || geoData.isp || "Unknown";
  const asn = geoData.as || "";

  if (whoisResult.status === "fulfilled") {
    const whois = whoisResult.value as Record<string, Record<string, unknown>>;
    const firstKey = Object.keys(whois)[0];
    if (firstKey && whois[firstKey]) {
      const whoisData = whois[firstKey];
      const potentialName =
        whoisData["NetName"] || whoisData["netname"] || whoisData["Organization"] || whoisData["descr"];
      const potentialOrg = whoisData["Organization"] || whoisData["org-name"] || whoisData["role"];

      if (potentialName) networkName = Array.isArray(potentialName) ? potentialName[0] : (potentialName as string);
      if (potentialOrg) orgName = Array.isArray(potentialOrg) ? potentialOrg[0] : (potentialOrg as string);
    }
  }

  const identity: NetworkIdentify = { isp: networkName, as: asn, asname: networkName, org: orgName };

  try {
    if (redis) {
      await redis.set(cacheKey, identity, { ex: 600 });
    } else {
      identifyCache.set(cacheKey, { data: identity, timestamp: Date.now() });
      if (identifyCache.size > 50) {
        const now = Date.now();
        for (const [key, entry] of identifyCache.entries()) {
          if (now - entry.timestamp > CACHE_TTL_MS) identifyCache.delete(key);
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "network-identify cache write failed", err: String(e) }));
  }

  return c.json(identity, 200, {
    "Cache-Control": "no-store, max-age=0",
    "X-Cache": "MISS",
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
  });
});
