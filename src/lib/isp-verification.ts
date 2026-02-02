import { ISP_LIST } from "./constants";
import { ASNInfo } from "@/types";

/**
 * Normalizes a string for comparison:
 * - Lowercase
 * - Removes extra spaces, punctuation
 */
function normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Pattern matching for specific ISPs
 * Maps keywords found in ASN info to our standardized ISP names
 */
const ISP_PATTERNS: Record<string, typeof ISP_LIST[number]> = {
    mtn: "MTN Nigeria",
    airtel: "Airtel Nigeria",
    glo: "Globacom (Glo)",
    globacom: "Globacom (Glo)",
    "9mobile": "9mobile",
    emts: "9mobile",
    etisalat: "9mobile", // Legacy name
    spectranet: "Spectranet",
    swift: "Swift Networks",
    ipnx: "ipNX",
    starlink: "Starlink Nigeria",
    spacex: "Starlink Nigeria",
    tizeti: "Tizeti (wifi.com.ng)",
    "wifi.com.ng": "Tizeti (wifi.com.ng)",
    cyberspace: "Cyberspace",
    mainone: "MainOne",
    coollink: "Coollink",
    ngcom: "Ngcom",
};

/**
 * Detects if the connected network matches a known Nigerian ISP
 * @param asnInfo - The ASN info from the IP lookup
 * @returns The matching ISP name from ISP_LIST, or null if no match found
 */
export function detectISP(asnInfo: ASNInfo): typeof ISP_LIST[number] | null {
    const sources = [
        asnInfo.isp,
        asnInfo.org,
        asnInfo.asname,
    ].filter(Boolean) as string[];

    // Check each source against our patterns
    for (const source of sources) {
        const normalizedSource = normalize(source);

        for (const [pattern, ispName] of Object.entries(ISP_PATTERNS)) {
            // Check if normalized pattern exists in normalized source
            if (normalizedSource.includes(pattern)) {
                return ispName;
            }
        }
    }

    return null;
}
