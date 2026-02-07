import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(keyHex, "hex");
}

/** Encrypt a plaintext string using AES-256-GCM. Returns iv:authTag:ciphertext (hex). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/** Decrypt a string previously encrypted with encrypt(). */
export function decrypt(encryptedStr: string): string {
  const key = getKey();
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted string format");
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/** Encrypt a coordinate number. */
export function encryptCoordinate(value: number): string {
  return encrypt(value.toFixed(10));
}

/** Decrypt back to a coordinate number. Handles legacy plain-text values from pre-encryption data. */
export function decryptCoordinate(encryptedStr: string): number {
  // Legacy data: plain number stored as text before encryption was added
  if (!encryptedStr.includes(":")) {
    const num = parseFloat(encryptedStr);
    if (!isNaN(num) && num >= -180 && num <= 180) {
      return num;
    }
    throw new Error("Invalid legacy coordinate value");
  }

  const num = parseFloat(decrypt(encryptedStr));
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
