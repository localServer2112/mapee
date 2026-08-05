import { z } from "../zod-setup";
import { ISPNameSchema } from "./common";

/**
 * One row of /v1/isp-rankings. Field names are normalised to camelCase here —
 * the current isp_rankings Postgres view returns its raw snake_case columns
 * unchanged (see /api/stats?type=isp), which is a wart specific to today's
 * implementation, not a shape worth carrying into v1.
 */
export const ISPRankingSchema = z
  .object({
    isp: ISPNameSchema,
    avgLatency: z.number().int().min(0),
    medianLatency: z.number().int().min(0),
    avgJitter: z.number().int().min(0),
    sampleCount: z.number().int().min(0),
    avgDownload: z.number().min(0).openapi({ description: "Mbps" }),
    avgUpload: z.number().min(0).openapi({ description: "Mbps" }),
  })
  .openapi("ISPRanking");

export type ISPRanking = z.infer<typeof ISPRankingSchema>;

export const ISPRankingsQuerySchema = z
  .object({
    region: z.string().optional().openapi({
      description: "Reserved for regional filtering (plan §12.4); unfiltered until a region dimension exists server-side.",
    }),
  })
  .openapi("ISPRankingsQuery");
