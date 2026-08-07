import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "./zod-setup";
import { AuthHeaderSchema, ErrorEnvelopeSchema } from "./schemas/common";
import { AreaSchema, AreaListQuerySchema } from "./schemas/area";
import {
  ScanSchema,
  ScanDetailSchema,
  ScanListQuerySchema,
  CreateScanRequestSchema,
  CreateScanResponseSchema,
  MyScansResponseSchema,
  DeleteMyScansResponseSchema,
} from "./schemas/scan";
import { ISPRankingSchema, ISPRankingsQuerySchema } from "./schemas/isp-ranking";
import { GeocodeResultSchema, GeocodeQuerySchema } from "./schemas/geocode";
import { CellTowerSchema, TowersQuerySchema } from "./schemas/tower";
import { NetworkIdentifySchema } from "./schemas/network";
import { ConfigSchema } from "./schemas/config";
import { CreateInstallRequestSchema, CreateInstallResponseSchema } from "./schemas/install";

/**
 * The v1 surface — see plan §7.4. This registry is the map from "existing
 * five routes" to the renamed, versioned paths, plus /v1/config, /v1/installs,
 * /v1/me/scans (new, no route to port from — these land with auth in A4).
 * /v1/measure/* is not yet covered — still using third-party throughput
 * endpoints per plan §6.2/§7.4's note, not a first-party one.
 *
 * Routes apps/api actually implements are defined as named exports below
 * rather than inline, so apps/api imports the exact same RouteConfig object
 * this registry uses for spec generation — one definition, reused for both
 * validation and documentation, per plan §7.3. Routes not yet implemented
 * anywhere stay inline; there is nothing for a second consumer to import yet.
 */
export const registry = new OpenAPIRegistry();

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorEnvelopeSchema } },
});

export const getAreasRoute = {
  method: "get" as const,
  path: "/v1/areas",
  summary: "Aggregated map cells within a bounding box",
  description: "The primary map read. Backed by the hexbin_stats materialized view.",
  tags: ["Map"],
  request: { query: AreaListQuerySchema },
  responses: {
    200: {
      description: "Aggregated cells",
      content: { "application/json": { schema: z.array(AreaSchema) } },
    },
    304: { description: "Not modified — If-None-Match matched the current ETag" },
    400: errorResponse("Invalid bounding box"),
    429: errorResponse("Rate limited"),
    500: errorResponse("Database error"),
  },
};
registry.registerPath(getAreasRoute);

export const getScansRoute = {
  method: "get" as const,
  path: "/v1/scans",
  summary: "Individual scans within a bounding box",
  description: "Returns grid-snapped coordinates, not exact ones. See ScanSchema.",
  tags: ["Map"],
  request: { query: ScanListQuerySchema },
  responses: {
    200: {
      description: "Scans in bounds",
      content: { "application/json": { schema: z.array(ScanSchema) } },
    },
    400: errorResponse("Invalid bounding box"),
    429: errorResponse("Rate limited"),
    500: errorResponse("Database error"),
  },
};
registry.registerPath(getScansRoute);

export const postScansRoute = {
  method: "post" as const,
  path: "/v1/scans",
  summary: "Submit a scan",
  description: "Requires an install token (POST /v1/installs). Idempotent on client-supplied id.",
  tags: ["Scans"],
  request: {
    headers: AuthHeaderSchema,
    body: {
      content: { "application/json": { schema: CreateScanRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Scan recorded",
      content: { "application/json": { schema: CreateScanResponseSchema } },
    },
    400: errorResponse("Validation failure, or an implausible measurement rejected as an outlier"),
    401: errorResponse("Missing or invalid install token"),
    429: errorResponse("Rate limited"),
    500: errorResponse("Database error"),
    503: errorResponse("Database not configured"),
  },
};
registry.registerPath(postScansRoute);

export const postInstallsRoute = {
  method: "post" as const,
  path: "/v1/installs",
  summary: "Register an anonymous install, returning a write/own-data token",
  description: "No auth required — this is how a client gets its first token. The token is returned exactly once.",
  tags: ["Installs"],
  request: {
    body: {
      content: { "application/json": { schema: CreateInstallRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Install registered",
      content: { "application/json": { schema: CreateInstallResponseSchema } },
    },
    400: errorResponse("Validation failure — see details"),
    429: errorResponse("Rate limited"),
    500: errorResponse("Database error"),
  },
};
registry.registerPath(postInstallsRoute);

export const getMyScansRoute = {
  method: "get" as const,
  path: "/v1/me/scans",
  summary: "List scans submitted by the authenticated install",
  description: "Exact coordinates throughout — this is the owning install, not a third party.",
  tags: ["Installs"],
  request: { headers: AuthHeaderSchema },
  responses: {
    200: {
      description: "This install's own scans",
      content: { "application/json": { schema: MyScansResponseSchema } },
    },
    401: errorResponse("Missing or invalid install token"),
  },
};
registry.registerPath(getMyScansRoute);

export const deleteMyScansRoute = {
  method: "delete" as const,
  path: "/v1/me/scans",
  summary: "Delete every scan submitted by the authenticated install",
  description: "Own-data deletion (store requirement). Irreversible; no per-id granularity.",
  tags: ["Installs"],
  request: { headers: AuthHeaderSchema },
  responses: {
    200: {
      description: "Deleted",
      content: { "application/json": { schema: DeleteMyScansResponseSchema } },
    },
    401: errorResponse("Missing or invalid install token"),
  },
};
registry.registerPath(deleteMyScansRoute);

export const getScanDetailRoute = {
  method: "get" as const,
  path: "/v1/scans/{id}",
  summary: "A single scan, at exact precision",
  description:
    "Exact coordinates are only ever returned here, and only to the submitting install (optional auth — a non-owner or unauthenticated caller gets grid coordinates instead, not a 401/403).",
  tags: ["Scans"],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "The scan",
      content: { "application/json": { schema: ScanDetailSchema } },
    },
    400: errorResponse("Invalid id"),
    404: errorResponse("Not found"),
    500: errorResponse("Stored data failed contract validation"),
    503: errorResponse("Database not configured"),
  },
};
registry.registerPath(getScanDetailRoute);

export const getIspRankingsRoute = {
  method: "get" as const,
  path: "/v1/isp-rankings",
  summary: "ISP rankings by median latency",
  description: "Split out of the overloaded ?type= param on the legacy /api/stats route.",
  tags: ["Insights"],
  request: { query: ISPRankingsQuerySchema },
  responses: {
    200: {
      description: "Rankings, fastest first",
      content: { "application/json": { schema: z.array(ISPRankingSchema) } },
    },
    429: errorResponse("Rate limited"),
    500: errorResponse("Database error"),
  },
};
registry.registerPath(getIspRankingsRoute);

export const getGeocodeRoute = {
  method: "get" as const,
  path: "/v1/geocode",
  summary: "Forward geocode a place name",
  description: "Proxies Nominatim. Renamed 'countrycodes' query param to 'country'.",
  tags: ["Location"],
  request: { query: GeocodeQuerySchema },
  responses: {
    200: {
      description: "Candidate locations",
      content: { "application/json": { schema: z.array(GeocodeResultSchema) } },
    },
    400: errorResponse("Query too short or missing"),
    429: errorResponse("Rate limited"),
    500: errorResponse("Nominatim (the upstream geocoding provider) failed"),
  },
};
registry.registerPath(getGeocodeRoute);

export const getTowersRoute = {
  method: "get" as const,
  path: "/v1/towers",
  summary: "Nearby cell towers within a bounding box",
  description: "Proxies OpenCelliD, clamped to its 4 sq km per-request limit.",
  tags: ["Location"],
  request: { query: TowersQuerySchema },
  responses: {
    200: {
      description: "Towers in bounds",
      content: { "application/json": { schema: z.array(CellTowerSchema) } },
    },
    304: { description: "Not modified — If-None-Match matched the current ETag" },
    400: errorResponse("Invalid bbox"),
    429: errorResponse("Rate limited"),
    502: errorResponse("OpenCelliD returned an error"),
    503: errorResponse("Provider not configured"),
  },
};
registry.registerPath(getTowersRoute);

export const getConfigRoute = {
  method: "get" as const,
  path: "/v1/config",
  summary: "Remote-tunable configuration",
  description: "ISP list, thresholds, measurement endpoints, minSupportedVersion. See plan §7.4 and §7.9.",
  tags: ["Config"],
  responses: {
    200: {
      description: "Current configuration",
      content: { "application/json": { schema: ConfigSchema } },
    },
  },
};
registry.registerPath(getConfigRoute);

export const getNetworkIdentifyRoute = {
  method: "get" as const,
  path: "/v1/network/identify",
  summary: "Identify the caller's ISP from their IP",
  description: "WHOIS + GeoIP dual lookup. Renamed from /api/asn — the old name described the lookup mechanism, not the purpose.",
  tags: ["Location"],
  responses: {
    200: {
      description: "Best-effort network identity. Always 200, even on lookup failure — see NetworkIdentifySchema's all-Unknown fallback shape.",
      content: { "application/json": { schema: NetworkIdentifySchema } },
    },
    429: errorResponse("Rate limited"),
  },
};
registry.registerPath(getNetworkIdentifyRoute);
