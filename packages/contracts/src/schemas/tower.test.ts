import { describe, it, expect } from "vitest";
import { CellTowerSchema, TowersQuerySchema } from "./tower";

describe("CellTowerSchema", () => {
  it("accepts a tower shaped like the OpenCelliD transform", () => {
    // From /api/towers: id is built as `${mcc}-${mnc}-${lac}-${cellid}`.
    expect(
      CellTowerSchema.safeParse({
        id: "621-30-1-12345",
        lat: 6.5244,
        lng: 3.3792,
        type: "4G",
        mcc: 621,
        mnc: 30,
        lac: 1,
        cellId: 12345,
      }).success
    ).toBe(true);
  });

  it("rejects a radio type outside 4G/5G", () => {
    expect(
      CellTowerSchema.safeParse({
        id: "x",
        lat: 6.5,
        lng: 3.3,
        type: "3G",
        mcc: 1,
        mnc: 1,
        lac: 1,
        cellId: 1,
      }).success
    ).toBe(false);
  });
});

describe("TowersQuerySchema", () => {
  it("accepts sw_lat,sw_lng,ne_lat,ne_lng order", () => {
    expect(TowersQuerySchema.safeParse({ bbox: "6.52,3.37,6.53,3.38" }).success).toBe(true);
  });

  it("rejects a bbox missing a component", () => {
    expect(TowersQuerySchema.safeParse({ bbox: "6.52,3.37,6.53" }).success).toBe(false);
  });
});
