import { z } from "../zod-setup";
import { DeviceTypeSchema, ISPNameSchema, LatSchema, LngSchema } from "./common";

/**
 * A single submitted scan.
 *
 * Mirrors PingLog (@mapee/core) with one deliberate divergence: list
 * endpoints return grid-snapped coordinates, not the exact ones. Only
 * GET /v1/scans/{id}, called by the submitting install, gets `lat`/`lng`
 * at full precision. See ScanDetailSchema, and plan §7.5 item 1 — the
 * current GET /api/pings decrypts and returns exact coordinates to any
 * caller, which is the bug this split is meant to fix.
 */
export const ScanSchema = z
  .object({
    id: z.string().uuid(),
    lat: LatSchema.openapi({
      description: "Grid-snapped to ~500m; not the submitter's exact location",
    }),
    lng: LngSchema.openapi({
      description: "Grid-snapped to ~500m; not the submitter's exact location",
    }),
    reportedISP: ISPNameSchema,
    verifiedASN: z.string().nullable(),
    latencyMs: z.number().int().min(0),
    jitter: z.number().int().min(0),
    uploadSpeed: z.number().min(0).openapi({ description: "Mbps" }),
    downloadSpeed: z.number().min(0).openapi({ description: "Mbps" }),
    measurementMethod: z.enum(["heuristic", "measured"]).openapi({
      description:
        "'heuristic' rows predate real throughput measurement and are excluded from ISP rankings. See plan §6.2 and §7.5 item 2.",
    }),
    deviceType: DeviceTypeSchema,
    timestamp: z.number().int().openapi({ description: "Unix ms" }),
  })
  .openapi("Scan");

export const ScanDetailSchema = ScanSchema.extend({
  lat: LatSchema.openapi({ description: "Exact submitted location" }),
  lng: LngSchema.openapi({ description: "Exact submitted location" }),
  isLocationExact: z.boolean().openapi({
    description:
      "False only for legacy rows predating coordinate encryption, where decryption falls back to the grid-snapped value. Always true for new scans.",
  }),
}).openapi("ScanDetail");

export const ScanListQuerySchema = z
  .object({
    bbox: z
      .string()
      .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
      .openapi({
        description: "south,west,north,east",
        example: "6.4,3.3,6.7,3.5",
      }),
    maxAge: z.coerce.number().int().min(1).max(90).default(30).openapi({
      description: "Days. Capped at 90 regardless of requested value.",
    }),
  })
  .openapi("ScanListQuery");

/**
 * Body for POST /v1/scans. The client generates its own scan ID (see
 * generateId in the web app) so a retried submission after a dropped
 * response is idempotent rather than double-counted.
 *
 * Deliberately no `userAgent` field, unlike the current POST /api/pings body.
 * The server reads the User-Agent request header itself rather than trusting
 * a client-supplied copy of it — one less client-controlled value to
 * validate, and it can't be spoofed independently of the actual request.
 */
export const CreateScanRequestSchema = z
  .object({
    id: z.string().uuid().optional(),
    lat: LatSchema,
    lng: LngSchema,
    reportedISP: ISPNameSchema,
    verifiedASN: z.string().optional(),
    latencyMs: z.number().min(0).max(10000),
    jitter: z.number().min(0).max(10000),
    uploadSpeed: z.number().min(0).max(10000),
    downloadSpeed: z.number().min(0).max(10000),
    deviceType: DeviceTypeSchema,
  })
  .openapi("CreateScanRequest");

export const CreateScanResponseSchema = z
  .object({
    success: z.literal(true),
    id: z.string().uuid(),
    timestamp: z.number().int(),
  })
  .openapi("CreateScanResponse");
