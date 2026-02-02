import { NextRequest, NextResponse } from "next/server";
import { ASNInfo } from "@/types";
import { whoisIp } from "whoiser";
import { apiRateLimits, createRateLimitResponse } from "@/lib/rate-limit";

/**
 * ASN Lookup API
 *
 * DUAL LOOKUP IMPLEMENTATION:
 * 1. WHOIS (via whoiser): For authoritative Network/ISP/ASN data.
 * 2. GeoIP (via ip-api): For Location (City, Lat/Lng).
 */

export const dynamic = "force-dynamic";

const IP_API_URL = "http://ip-api.com/json";

// Cache ASN lookups for 10 minutes
const asnCache = new Map<string, { data: ASNInfo; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = apiRateLimits.asn(request);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.reset);
  }

  try {
    // Get client IP
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    let clientIp = forwardedFor?.split(",")[0] || realIp || null;

    // Handle localhost for testing
    if (!clientIp || clientIp === "::1" || clientIp === "127.0.0.1") {
      // Default to a Nigerian IP for verified testing if on localhost
      // This ensures the "Dual Lookup" logic can actually be tested locally
      clientIp = "105.112.96.1"; // MTN Nigeria IP example
    }

    // Check cache
    const cached = asnCache.get(clientIp);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Cache": "HIT",
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      });
    }

    // 1. DUAL LOOKUP: Run requests in parallel
    const [whoisResult, geoResult] = await Promise.allSettled([
      whoisIp(clientIp),
      fetch(`${IP_API_URL}/${clientIp}`).then(res => res.json())
    ]);

    // 2. Process GeoIP (Location)
    let geoData: any = {};
    if (geoResult.status === "fulfilled") {
      geoData = geoResult.value;
    }

    // 3. Process WHOIS (Network)
    let whoisData: any = {};
    let networkName = geoData.isp || "Unknown"; // Fallback to GeoIP ISP
    let orgName = geoData.org || geoData.isp || "Unknown";
    let asn = geoData.as || "";

    if (whoisResult.status === "fulfilled") {
      const whois = whoisResult.value;
      // whoiser returns an object keyed by registry (e.g. 'whois.afrinic.net')
      // We look for the first valid object
      const firstKey = Object.keys(whois)[0];
      if (firstKey && whois[firstKey]) {
        whoisData = whois[firstKey];

        // Extract authoritative names if available
        // Different registries use different keys (NetName, org-name, etc.)
        const potentialName = whoisData["NetName"] || whoisData["netname"] || whoisData["Organization"] || whoisData["descr"];
        const potentialOrg = whoisData["Organization"] || whoisData["org-name"] || whoisData["role"];

        if (potentialName) networkName = Array.isArray(potentialName) ? potentialName[0] : potentialName;
        if (potentialOrg) orgName = Array.isArray(potentialOrg) ? potentialOrg[0] : potentialOrg;
      }
    }

    // 4. Combine Results
    // We prioritize WHOIS for Network Identity and GeoIP for Location (implicit in app structure, but here we return ASNInfo)
    const asnInfo: ASNInfo = {
      isp: networkName, // "MTN Nigeria" etc.
      as: asn,
      asname: networkName,
      org: orgName,
    };

    // Cache the result
    asnCache.set(clientIp, { data: asnInfo, timestamp: Date.now() });

    // Clean old cache entries periodically
    if (asnCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of asnCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          asnCache.delete(key);
        }
      }
    }

    return NextResponse.json(asnInfo, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Cache": "MISS",
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });

  } catch (error) {
    console.error("Lookup error:", error);
    return NextResponse.json(
      { isp: "Unknown", as: "", asname: "", org: "Unknown" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
