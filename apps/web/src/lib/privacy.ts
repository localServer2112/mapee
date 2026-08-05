/**
 * GPS Coordinate Jittering for Privacy
 *
 * Adds random noise to coordinates to prevent exact location tracking.
 * Jitter range: approximately 50-100 meters.
 */

// 0.0002 degrees ≈ 20-25 meters at equator
const JITTER_AMOUNT = 0.0002;

/**
 * Add random noise to GPS coordinates for privacy
 * @param lat - Original latitude
 * @param lng - Original longitude
 * @returns Jittered coordinates (approximately 10-30m from original)
 */
export function jitterCoordinates(
  lat: number,
  lng: number
): { lat: number; lng: number } {
  // Use a random factor between 0.8 and 1.2 to vary the distance slightly
  const factor = 0.8 + Math.random() * 0.4;
  const currentJitter = JITTER_AMOUNT * factor;

  const latJitter = (Math.random() - 0.5) * 2 * currentJitter;
  const lngJitter = (Math.random() - 0.5) * 2 * currentJitter;

  return {
    lat: lat + latJitter,
    lng: lng + lngJitter,
  };
}

/**
 * Round coordinates to reduce precision for privacy
 * Rounds to ~11m precision (4 decimal places)
 */
export function roundCoordinates(
  lat: number,
  lng: number
): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
  };
}

/**
 * Generate a privacy disclaimer message
 */
export function getPrivacyDisclaimer(): string {
  return "Your exact location is anonymized. Coordinates are randomly adjusted by 10-30 meters to protect your privacy.";
}
