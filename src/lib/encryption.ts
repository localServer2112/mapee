const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

/**
 * Parses the 64-character hex string into a CryptoKey for Web Crypto API.
 */
async function getKey(): Promise<CryptoKey> {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
}

/** Encrypt a plaintext string using AES-256-GCM. Returns iv:authTag:ciphertext (hex). */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    key,
    encoded
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

  // WebCrypto AES-GCM appends the 16-byte auth tag at the end of the ciphertext.
  // We slice it to maintain backwards compatibility with the existing Node.js format.
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

  // WebCrypto expects the auth tag appended to the ciphertext
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  // Create a strict ArrayBuffer copy to satisfy TypeScript DOM types
  // which reject SharedArrayBuffer variants implied by ArrayBufferLike
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
  return await encrypt(value.toFixed(10));
}

/** Decrypt back to a coordinate number. Handles legacy plain-text values from pre-encryption data. */
export async function decryptCoordinate(encryptedStr: string): Promise<number> {
  // Legacy data: plain number stored as text before encryption was added
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
 * Uses the same grid constants as the hexbin_stats materialized view.
 */
export function computeGridCoordinates(
  lat: number,
  lng: number
): { lat_grid: number; lng_grid: number } {
  const LAT_STEP = 0.0045;
  const LNG_STEP = 0.005;

  return {
    lat_grid: Math.floor(lat / LAT_STEP) * LAT_STEP + LAT_STEP / 2,
    lng_grid: Math.floor(lng / LNG_STEP) * LNG_STEP + LNG_STEP / 2,
  };
}
