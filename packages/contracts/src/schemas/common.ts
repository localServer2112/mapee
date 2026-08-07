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
/**
 * Every write endpoint and every own-data endpoint requires this (plan
 * §7.6). Validated against the `installs` table by apps/api's auth
 * middleware, not by Zod itself — this only checks the header is shaped
 * like a bearer token, not that it resolves to a real install.
 */
export const AuthHeaderSchema = z.object({
  authorization: z.string().regex(/^Bearer .+/).openapi({
    description: "Bearer <install token>",
    example: "Bearer 5f3c2a1e9b7d4f6a8c0e2b4d6f8a0c2e",
  }),
});

export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: "invalid_bounds" }),
      message: z.string().openapi({ example: "Invalid bounding box coordinates" }),
      details: z.record(z.unknown()).optional(),
    }),
  })
  .openapi("Error");
