import { NextRequest, NextResponse } from "next/server";
import { ASNInfo } from "@/types";

/**
 * ASN Lookup API
 *
 * Uses ip-api.com to detect the user's ISP based on their IP address.
 * Free tier allows 45 requests per minute.
 */

// Force dynamic rendering - this route uses request headers
export const dynamic = "force-dynamic";

const IP_API_URL = "http://ip-api.com/json";

export async function GET(request: NextRequest) {
  try {
    // Get client IP from headers (works with most reverse proxies)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwardedFor?.split(",")[0] || realIp || null;

    // Build the API URL
    const apiUrl = clientIp ? `${IP_API_URL}/${clientIp}` : IP_API_URL;

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`IP-API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "fail") {
      throw new Error(data.message || "IP lookup failed");
    }

    const asnInfo: ASNInfo = {
      isp: data.isp || "Unknown",
      as: data.as || "",
      asname: data.asname || "",
      org: data.org || data.isp || "Unknown",
    };

    return NextResponse.json(asnInfo, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("ASN lookup error:", error);

    // Return a fallback response
    return NextResponse.json(
      {
        isp: "Unknown",
        as: "",
        asname: "",
        org: "Unknown",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
