/**
 * GPS Coordinate Jittering for Privacy
 *
 * Adds random noise to coordinates to prevent exact location tracking.
 * Jitter range: approximately 50-100 meters.
 */

// 0.0005 degrees ≈ 55 meters at equator
const JITTER_AMOUNT = 0.0005;

/**
 * Add random noise to GPS coordinates for privacy
 * @param lat - Original latitude
 * @param lng - Original longitude
 * @returns Jittered coordinates (approximately 50-100m from original)
 */
export function jitterCoordinates(
  lat: number,
  lng: number
): { lat: number; lng: number } {
  const latJitter = (Math.random() - 0.5) * 2 * JITTER_AMOUNT;
  const lngJitter = (Math.random() - 0.5) * 2 * JITTER_AMOUNT;

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
  return "Your exact location is anonymized. Coordinates are randomly adjusted by 50-100 meters to protect your privacy.";
}
