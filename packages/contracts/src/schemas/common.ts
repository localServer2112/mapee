import { z } from "../zod-setup";
import { ISP_LIST } from "@mapee/core";

export const LatSchema = z.number().min(-90).max(90).openapi({ example: 6.5244 });
export const LngSchema = z.number().min(-180).max(180).openapi({ example: 3.3792 });

export const MapBoundsSchema = z
  .object({
    north: LatSchema,
    south: LatSchema,
    east: LngSchema,
    west: LngSchema,
  })
  .openapi("MapBounds");

export const ISPNameSchema = z.enum(ISP_LIST).openapi("ISPName");

export const LatencyStatusSchema = z.enum(["good", "fair", "poor"]).openapi("LatencyStatus");

export const DeviceTypeSchema = z.enum(["mobile", "tablet", "desktop"]).openapi("DeviceType");

/**
 * Every error response uses this envelope. `code` is a stable machine-readable
 * string for client branching; `message` is safe to show a user; `details` is
 * free-form and present only for validation failures.
 */
export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: "invalid_bounds" }),
      message: z.string().openapi({ example: "Invalid bounding box coordinates" }),
      details: z.record(z.unknown()).optional(),
    }),
  })
  .openapi("Error");
