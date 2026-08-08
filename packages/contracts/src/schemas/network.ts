import { z } from "../zod-setup";

/**
 * Result of the WHOIS + GeoIP dual lookup used to auto-detect a caller's ISP.
 * Renamed from ASNInfo's implicit route (/api/asn) to /v1/network/identify —
 * "asn" described the lookup mechanism, not what the endpoint is for.
 */
export const NetworkIdentifySchema = z
  .object({
    isp: z.string(),
    as: z.string(),
    asname: z.string(),
    org: z.string(),
  })
  .openapi("NetworkIdentify");

export type NetworkIdentify = z.infer<typeof NetworkIdentifySchema>;
