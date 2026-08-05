import { describe, it, expect } from "vitest";
import { GeocodeResultSchema, GeocodeQuerySchema } from "./geocode";

describe("GeocodeResultSchema", () => {
  it("accepts a result with a boundingBox", () => {
    // Shaped like GET /api/geocode's transform of a Nominatim result.
    expect(
      GeocodeResultSchema.safeParse({
        displayName: "Lagos, Nigeria",
        lat: 6.5244,
        lng: 3.3792,
        boundingBox: [6.393, 6.702, 3.093, 3.6],
      }).success
    ).toBe(true);
  });

  it("accepts a result with no boundingBox", () => {
    expect(
      GeocodeResultSchema.safeParse({
        displayName: "10 Williams Okoro Street",
        lat: 6.5244,
        lng: 3.3792,
      }).success
    ).toBe(true);
  });

  it("rejects a boundingBox with the wrong arity", () => {
    expect(
      GeocodeResultSchema.safeParse({
        displayName: "Lagos, Nigeria",
        lat: 6.5244,
        lng: 3.3792,
        boundingBox: [6.393, 6.702, 3.093],
      }).success
    ).toBe(false);
  });
});

describe("GeocodeQuerySchema", () => {
  it("rejects a query under 2 characters", () => {
    expect(GeocodeQuerySchema.safeParse({ q: "a" }).success).toBe(false);
  });

  it("accepts a 2-letter ISO country code", () => {
    expect(GeocodeQuerySchema.safeParse({ q: "Lagos", country: "ng" }).success).toBe(true);
  });

  it("rejects a country code of the wrong length", () => {
    expect(GeocodeQuerySchema.safeParse({ q: "Lagos", country: "nga" }).success).toBe(false);
  });
});
