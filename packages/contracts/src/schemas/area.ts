import { z } from "../zod-setup";
import { LatSchema, LngSchema } from "./common";

/**
 * An aggregated map cell, from the hexbin_stats materialized view.
 *
 * `id` is presently the raw "{latBucket}_{lngBucket}" string the view
 * generates (see get_hexbin_stats_in_bounds in supabase/schema.sql) — kept
 * opaque here deliberately, since the plan (§8) treats the exact binning
 * scheme as a server-internal detail clients should not parse or replicate.
 */
export const AreaSchema = z
  .object({
    id: z.string(),
    centerLat: LatSchema,
    centerLng: LngSchema,
    avgLatency: z.number().int().min(0),
    minLatency: z.number().int().min(0),
    maxLatency: z.number().int().min(0),
    scanCount: z.number().int().min(0),
    topISP: z.string(),
    confidence: z.number().int().min(0).max(100),
    consistency: z.number().int().min(0).max(100),
  })
  .openapi("Area");

export type Area = z.infer<typeof AreaSchema>;

export const AreaListQuerySchema = z
  .object({
    bbox: z
      .string()
      .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
      .openapi({
        description: "south,west,north,east",
        example: "6.4,3.3,6.7,3.5",
      }),
    zoom: z.coerce.number().int().min(0).max(22).optional().openapi({
      description:
        "Reserved for zoom-aware aggregation precision (plan §7.4); unused until a zoom-dependent grid exists server-side.",
    }),
  })
  .openapi("AreaListQuery");
