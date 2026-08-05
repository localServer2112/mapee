import { z } from "../zod-setup";
import { LatSchema, LngSchema } from "./common";

export const GeocodeResultSchema = z
  .object({
    displayName: z.string(),
    lat: LatSchema,
    lng: LngSchema,
    boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional().openapi({
      description: "[south, north, west, east] — Nominatim's order, kept as-is",
    }),
  })
  .openapi("GeocodeResult");

export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

export const GeocodeQuerySchema = z
  .object({
    // .trim() runs before .min(2), not after — otherwise "  a" (length 3)
    // passes validation and only becomes too-short once a handler trims it
    // itself, which is a check every consumer would have to remember to
    // duplicate. Trimming inside the schema makes the guarantee unconditional.
    q: z.string().trim().min(2).max(200),
    country: z.string().length(2).optional().openapi({
      description: "ISO 3166-1 alpha-2, e.g. 'ng'. Renamed from 'countrycodes'.",
    }),
  })
  .openapi("GeocodeQuery");
