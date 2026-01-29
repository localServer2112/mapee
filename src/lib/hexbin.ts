import { PingLog, HexBin } from "@/types";
import { HEXBIN_CONFIG } from "./constants";
import {
  calculateWeightedAverageLatency,
  calculateConfidenceScore,
  calculateConsistency,
  getTopISP,
} from "./confidence";

/**
 * Hexagonal Binning Utility
 *
 * Groups pings into hexagonal bins for visualization.
 * Uses a simple flat-topped hexagonal grid.
 */

/**
 * Convert lat/lng to hexbin grid coordinates
 */
function getHexCoords(
  lat: number,
  lng: number,
  radius: number
): { x: number; y: number } {
  // Hexagon dimensions
  const hexWidth = radius * 2;
  const hexHeight = radius * Math.sqrt(3);

  // Convert to grid coordinates
  const col = Math.floor(lng / (hexWidth * 0.75));
  const row = Math.floor(lat / hexHeight);

  // Adjust for offset rows (flat-topped hexagons)
  const adjustedRow = col % 2 === 0 ? row : row - 0.5;

  return {
    x: col,
    y: Math.round(adjustedRow),
  };
}

/**
 * Get the center coordinates of a hexbin
 */
function getHexCenter(
  x: number,
  y: number,
  radius: number
): { lat: number; lng: number } {
  const hexWidth = radius * 2;
  const hexHeight = radius * Math.sqrt(3);

  const lng = x * hexWidth * 0.75 + radius;
  const lat = (x % 2 === 0 ? y : y + 0.5) * hexHeight + hexHeight / 2;

  return { lat, lng };
}

/**
 * Generate a unique key for a hexbin
 */
function getHexKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Group pings into hexagonal bins
 */
export function createHexbins(
  pings: PingLog[],
  radius: number = HEXBIN_CONFIG.RADIUS
): HexBin[] {
  const hexMap = new Map<string, PingLog[]>();

  // Group pings by hexbin
  for (const ping of pings) {
    const { x, y } = getHexCoords(ping.lat, ping.lng, radius);
    const key = getHexKey(x, y);

    if (!hexMap.has(key)) {
      hexMap.set(key, []);
    }
    hexMap.get(key)!.push(ping);
  }

  // Convert to HexBin objects
  const hexbins: HexBin[] = [];

  for (const [key, binPings] of hexMap) {
    if (binPings.length < HEXBIN_CONFIG.MIN_PINGS_FOR_DISPLAY) continue;

    const [x, y] = key.split(",").map(Number);
    const center = getHexCenter(x, y, radius);

    hexbins.push({
      x,
      y,
      centerLat: center.lat,
      centerLng: center.lng,
      pings: binPings,
      avgLatency: calculateWeightedAverageLatency(binPings),
      confidence: calculateConfidenceScore(binPings),
      topISP: getTopISP(binPings),
      consistency: calculateConsistency(binPings),
    });
  }

  return hexbins;
}

/**
 * Generate SVG path for a flat-topped hexagon
 */
export function getHexagonPath(
  centerX: number,
  centerY: number,
  radius: number
): string {
  const points: string[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }

  return `M${points.join("L")}Z`;
}

/**
 * Get hexbins within a bounding box
 */
export function getHexbinsInBounds(
  hexbins: HexBin[],
  north: number,
  south: number,
  east: number,
  west: number
): HexBin[] {
  return hexbins.filter((hex) => {
    return (
      hex.centerLat >= south &&
      hex.centerLat <= north &&
      hex.centerLng >= west &&
      hex.centerLng <= east
    );
  });
}

/**
 * Find the hexbin containing a specific point
 */
export function findHexbinAtPoint(
  hexbins: HexBin[],
  lat: number,
  lng: number,
  radius: number = HEXBIN_CONFIG.RADIUS
): HexBin | null {
  const { x, y } = getHexCoords(lat, lng, radius);

  return (
    hexbins.find((hex) => hex.x === x && hex.y === y) || null
  );
}
