import { GRID } from "@mapee/core";

/**
 * Ported from apps/web/src/lib/encryption.ts. Same AES-256-GCM scheme, same
 * iv:authTag:ciphertext (hex) wire format, same legacy-plaintext fallback in
 * decryptCoordinate — this is the only service that will ever hold
 * ENCRYPTION_KEY once apps/web's copy is retired at cutover (plan §7.1), so
 * getting the wire format byte-for-byte identical matters: any drift here
 * would make apps/web's already-encrypted rows undecryptable.
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

async function getKey(): Promise<CryptoKey> {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  return crypto.subtle.importKey("raw", keyBytes, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);
}

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
}

/** Encrypt a plaintext string using AES-256-GCM. Returns iv:authTag:ciphertext (hex). */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt({ name: ALGORITHM, iv: iv as BufferSource }, key, encoded);
  const cipherBytes = new Uint8Array(cipherBuffer);

  // WebCrypto's AES-GCM appends the 16-byte auth tag to the ciphertext;
  // sliced apart here to keep the wire format's three-part shape.
  const ciphertext = cipherBytes.slice(0, -16);
  const authTag = cipherBytes.slice(-16);

  return `${toHex(iv)}:${toHex(authTag)}:${toHex(ciphertext)}`;
}

/** Decrypt a string previously encrypted with encrypt(). */
export async function decrypt(encryptedStr: string): Promise<string> {
  const key = await getKey();
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted string format");
  }

  const iv = fromHex(parts[0]);
  const authTag = fromHex(parts[1]);
  const ciphertext = fromHex(parts[2]);

  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  // A strict ArrayBuffer copy — WebCrypto's DOM types reject the
  // SharedArrayBuffer-flavoured ArrayBufferLike a plain Uint8Array.buffer can be.
  const combinedBuffer = new ArrayBuffer(combined.length);
  new Uint8Array(combinedBuffer).set(combined);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    key,
    combinedBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/** Encrypt a coordinate number. */
export async function encryptCoordinate(value: number): Promise<string> {
  return encrypt(value.toFixed(10));
}

/** Decrypt back to a coordinate number. Handles legacy plain-text values from pre-encryption data. */
export async function decryptCoordinate(encryptedStr: string): Promise<number> {
  if (!encryptedStr.includes(":")) {
    const num = parseFloat(encryptedStr);
    if (!isNaN(num) && num >= -180 && num <= 180) {
      return num;
    }
    throw new Error("Invalid legacy coordinate value");
  }

  const num = parseFloat(await decrypt(encryptedStr));
  if (isNaN(num)) {
    throw new Error("Decrypted value is not a valid number");
  }
  return num;
}

/**
 * Compute grid-cell center coordinates (~500m precision).
 *
 * Uses GRID from @mapee/core rather than re-declaring the 0.0045/0.005
 * constants locally — the legacy apps/web/src/lib/encryption.ts hardcodes
 * them a second time next to an identical pair already living in the
 * hexbin_stats materialized view (supabase/schema.sql). Two independent
 * copies of the same magic numbers is exactly the drift risk plan §8 warns
 * about for the aggregation grid; this port collapses it to one.
 */
export function computeGridCoordinates(lat: number, lng: number): { lat_grid: number; lng_grid: number } {
  return {
    lat_grid: Math.floor(lat / GRID.LAT_STEP) * GRID.LAT_STEP + GRID.LAT_STEP / 2,
    lng_grid: Math.floor(lng / GRID.LNG_STEP) * GRID.LNG_STEP + GRID.LNG_STEP / 2,
  };
}
