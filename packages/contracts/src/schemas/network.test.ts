import { describe, it, expect } from "vitest";
import { NetworkIdentifySchema } from "./network";

describe("NetworkIdentifySchema", () => {
  it("accepts the shape /api/asn returns on a successful lookup", () => {
    expect(
      NetworkIdentifySchema.safeParse({
        isp: "MTN Nigeria",
        as: "AS29465",
        asname: "MTN Nigeria",
        org: "MTN Nigeria Communications",
      }).success
    ).toBe(true);
  });

  it("accepts the all-Unknown fallback shape on lookup failure", () => {
    // /api/asn's catch block returns { isp: "Unknown", as: "", asname: "",
    // org: "Unknown" } rather than an error response — worth pinning that
    // empty strings are valid here, since this is a real code path, not a
    // hypothetical.
    expect(
      NetworkIdentifySchema.safeParse({
        isp: "Unknown",
        as: "",
        asname: "",
        org: "Unknown",
      }).success
    ).toBe(true);
  });
});
