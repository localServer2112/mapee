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

export const GeocodeQuerySchema = z
  .object({
    q: z.string().min(2).max(200),
    country: z.string().length(2).optional().openapi({
      description: "ISO 3166-1 alpha-2, e.g. 'ng'. Renamed from 'countrycodes'.",
    }),
  })
  .openapi("GeocodeQuery");
