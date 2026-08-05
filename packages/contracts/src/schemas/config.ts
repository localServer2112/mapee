import { z } from "../zod-setup";
import { ISP_LIST } from "@mapee/core";

/**
 * Remote config so tuning thresholds, adding an ISP, or raising the minimum
 * supported client version doesn't require a mobile release. See plan §7.4
 * and §7.9. This is a NEW endpoint — no legacy route to port shape from, so
 * every field here is a fresh decision, not a carried-over one.
 */
export const ConfigSchema = z
  .object({
    ispList: z.array(z.string()).openapi({
      description: "The canonical ISP list. Currently mirrors ISP_LIST in @mapee/core verbatim.",
      example: [...ISP_LIST],
    }),
    latencyThresholds: z
      .object({
        good: z.number().int().openapi({ description: "ms; <= this is 'good'" }),
        fair: z.number().int().openapi({ description: "ms; <= this is 'fair', above is 'poor'" }),
      })
      .openapi("LatencyThresholds"),
    dataFreshness: z
      .object({
        freshDays: z.number().int(),
        staleDays: z.number().int(),
        expiredDays: z.number().int(),
      })
      .openapi("DataFreshness"),
    measurementEndpoints: z
      .object({
        download: z.string().url().openapi({
          description:
            "Not a Mapee-hosted endpoint yet — see plan §6.2/§7.4. Points at a public third-party throughput-test endpoint until /v1/measure/* ships.",
        }),
        upload: z.string().url(),
      })
      .openapi("MeasurementEndpoints"),
    minSupportedVersion: z.string().openapi({
      description:
        "Semver floor for mobile clients. No mobile client exists yet (Track B), so this currently has no enforcement teeth — present so the contract shape is settled before it needs to bite.",
      example: "0.1.0",
    }),
  })
  .openapi("Config");

export type Config = z.infer<typeof ConfigSchema>;
