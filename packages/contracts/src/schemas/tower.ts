import { z } from "../zod-setup";
import { LatSchema, LngSchema } from "./common";

export const CellTowerSchema = z
  .object({
    id: z.string().openapi({ description: "mcc-mnc-lac-cellId" }),
    lat: LatSchema,
    lng: LngSchema,
    type: z.enum(["4G", "5G"]),
    mcc: z.number().int(),
    mnc: z.number().int(),
    lac: z.number().int(),
    cellId: z.number().int(),
  })
  .openapi("CellTower");

export type CellTower = z.infer<typeof CellTowerSchema>;

export const TowersQuerySchema = z
  .object({
    bbox: z
      .string()
      .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
      .openapi({
        description:
          "sw_lat,sw_lng,ne_lat,ne_lng — clamped server-side to OpenCelliD's 4 sq km per-request limit",
        example: "6.52,3.37,6.53,3.38",
      }),
  })
  .openapi("TowersQuery");
