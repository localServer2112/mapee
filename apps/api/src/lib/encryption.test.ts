import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GRID } from "@mapee/core";
import {
  encrypt,
  decrypt,
  encryptCoordinate,
  decryptCoordinate,
  computeGridCoordinates,
} from "./encryption.js";

// Generated via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
// and its length verified programmatically before use, not by eye — a
// hand-typed hex string is exactly the kind of thing easy to get subtly
// wrong (an earlier draft of this file was one character short).
const TEST_KEY = "311493eba94b1bf968f104172db5de55bd386dfe76acc39a654453a889759142";

it("TEST_KEY is a valid 64-char hex key — guards against a repeat of the off-by-one that broke this suite once already", () => {
  expect(TEST_KEY).toHaveLength(64);
  expect(TEST_KEY).toMatch(/^[0-9a-f]{64}$/);
});

describe("encrypt / decrypt", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("round-trips a plaintext string", async () => {
    const ciphertext = await encrypt("hello world");
    expect(await decrypt(ciphertext)).toBe("hello world");
  });

  it("produces the iv:authTag:ciphertext hex format with three colon-separated parts", async () => {
    const ciphertext = await encrypt("test");
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => /^[0-9a-f]+$/.test(p))).toBe(true);
  });

  it("produces a different ciphertext each time (random IV), same plaintext recovered either way", async () => {
    const a = await encrypt("same plaintext");
    const b = await encrypt("same plaintext");
    expect(a).not.toBe(b);
    expect(await decrypt(a)).toBe("same plaintext");
    expect(await decrypt(b)).toBe("same plaintext");
  });

  it("rejects a malformed ciphertext rather than silently returning garbage", async () => {
    await expect(decrypt("not-the-right-format")).rejects.toThrow("Invalid encrypted string format");
  });

  it("throws when ENCRYPTION_KEY is unset", async () => {
    delete process.env.ENCRYPTION_KEY;
    await expect(encrypt("test")).rejects.toThrow(/ENCRYPTION_KEY must be/);
  });

  it("throws when ENCRYPTION_KEY isn't exactly 64 hex characters", async () => {
    process.env.ENCRYPTION_KEY = "too-short";
    await expect(encrypt("test")).rejects.toThrow(/ENCRYPTION_KEY must be/);
  });
});

describe("encryptCoordinate / decryptCoordinate", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("round-trips a coordinate to 10 decimal places", async () => {
    const encrypted = await encryptCoordinate(6.5244123456);
    expect(await decryptCoordinate(encrypted)).toBeCloseTo(6.5244123456, 9);
  });

  it("round-trips a negative coordinate", async () => {
    const encrypted = await encryptCoordinate(-122.4194);
    expect(await decryptCoordinate(encrypted)).toBeCloseTo(-122.4194, 9);
  });

  it("reads a legacy plaintext coordinate (pre-encryption data) directly, without decrypting", async () => {
    // No colons -> not the encrypted wire format -> treated as a raw number,
    // per the legacy-data fallback this function has always had.
    expect(await decryptCoordinate("3.3792")).toBe(3.3792);
  });

  it("rejects an out-of-range legacy value rather than accepting garbage as a coordinate", async () => {
    await expect(decryptCoordinate("99999")).rejects.toThrow("Invalid legacy coordinate value");
  });

  it(
    "decrypts a real ciphertext produced by apps/web's current encryption.ts — proves the wire " +
      "format is actually byte-compatible across the two implementations, not just structurally similar",
    async () => {
      // Fixture generated once, for real, by running apps/web's own
      // encryptCoordinate(6.5244123456) under a fixed test key:
      //   cd apps/web && ENCRYPTION_KEY=<fixtureKey> npx tsx -e \
      //     "import('./src/lib/encryption').then(m => \
      //        m.encryptCoordinate(6.5244123456).then(console.log))"
      // If this test ever fails, it means a change to apps/api's AES-GCM
      // handling (IV length, auth-tag slicing, hex encoding) has drifted
      // from apps/web's — which would make every coordinate apps/web has
      // already encrypted and stored undecryptable by this service.
      const fixtureKey = "b229fdee31bc2ff2726583780c620619183f6a03bd50de3df0855b9a19690a16";
      const fixtureCiphertext =
        "8e74be49a87e6be7f1999071:6609652bfe71a0bda97c48e9d0290d65:791536a6598f01f3f81db12d";

      process.env.ENCRYPTION_KEY = fixtureKey;
      const recovered = await decryptCoordinate(fixtureCiphertext);
      expect(recovered).toBeCloseTo(6.5244123456, 9);
    }
  );
});

describe("computeGridCoordinates", () => {
  it("uses @mapee/core's GRID constants, not a locally hardcoded duplicate", () => {
    // The legacy apps/web/src/lib/encryption.ts hardcodes 0.0045/0.005
    // directly rather than importing them — this test would still pass
    // against that duplicate today, but it exists to guarantee this port's
    // output only ever moves in lockstep with @mapee/core's GRID, since
    // that's the single source these constants are meant to have.
    const { lat_grid, lng_grid } = computeGridCoordinates(6.5244, 3.3792);
    const expectedLat = Math.floor(6.5244 / GRID.LAT_STEP) * GRID.LAT_STEP + GRID.LAT_STEP / 2;
    const expectedLng = Math.floor(3.3792 / GRID.LNG_STEP) * GRID.LNG_STEP + GRID.LNG_STEP / 2;
    expect(lat_grid).toBeCloseTo(expectedLat, 10);
    expect(lng_grid).toBeCloseTo(expectedLng, 10);
  });

  it("snaps to the same cell for nearby points, a different cell once they cross a boundary", () => {
    const a = computeGridCoordinates(6.5244, 3.3792);
    const b = computeGridCoordinates(6.52441, 3.37921); // ~1m away
    expect(a).toEqual(b);

    const c = computeGridCoordinates(6.5244 + GRID.LAT_STEP, 3.3792);
    expect(c.lat_grid).not.toBeCloseTo(a.lat_grid, 5);
  });
});
