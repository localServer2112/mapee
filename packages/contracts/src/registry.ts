import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "./zod-setup";
import { ErrorEnvelopeSchema } from "./schemas/common";
import { AreaSchema, AreaListQuerySchema } from "./schemas/area";
import {
  ScanSchema,
  ScanDetailSchema,
  ScanListQuerySchema,
  CreateScanRequestSchema,
  CreateScanResponseSchema,
} from "./schemas/scan";
import { ISPRankingSchema, ISPRankingsQuerySchema } from "./schemas/isp-ranking";
import { GeocodeResultSchema, GeocodeQuerySchema } from "./schemas/geocode";
import { CellTowerSchema, TowersQuerySchema } from "./schemas/tower";
import { NetworkIdentifySchema } from "./schemas/network";
import { ConfigSchema } from "./schemas/config";

/**
 * The v1 surface — see plan §7.4. This registry is the map from "existing
 * five routes" to the renamed, versioned paths, plus /v1/config (new, no
 * route to port from). It does not yet cover /v1/installs, /v1/me/scans, or
 * /v1/measure/*, which land with auth in a later phase (A4) once there's a
 * server to authenticate against.
 *
 * Routes apps/api actually implements (currently: config, geocode) are
 * defined as named exports below rather than inline, so apps/api imports the
 * exact same RouteConfig object this registry uses for spec generation —
 * one definition, reused for both validation and documentation, per plan
 * §7.3. Routes not yet implemented anywhere stay inline; there is nothing
 * for a second consumer to import yet.
 */
export const registry = new OpenAPIRegistry();

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorEnvelopeSchema } },
});

registry.registerPath({
  method: "get",
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
    400: errorResponse("Invalid bounding box"),
    429: errorResponse("Rate limited"),
  },
});

registry.registerPath({
  method: "get",
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
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/scans",
  summary: "Submit a scan",
  description: "Requires an install token once auth lands in A4. Idempotent on client-supplied id.",
  tags: ["Scans"],
  request: {
    body: {
      content: { "application/json": { schema: CreateScanRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Scan recorded",
      content: { "application/json": { schema: CreateScanResponseSchema } },
    },
    400: errorResponse("Validation failure — see details"),
    429: errorResponse("Rate limited"),
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/scans/{id}",
  summary: "A single scan, at exact precision",
  description: "Exact coordinates are only ever returned here, and only to the submitting install once A4 auth lands.",
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
  },
});

registry.registerPath({
  method: "get",
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
  },
});

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
