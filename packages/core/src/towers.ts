import { CellTower } from "./types";

/**
 * Cell Tower Utilities
 *
 * Functions for working with cell tower data and calculating
 * distances for spider-leg visualizations.
 */

/**
 * Calculate the distance between two points using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find the N nearest cell towers to a given point
 */
export function findNearestTowers(
  lat: number,
  lng: number,
  towers: CellTower[],
  count: number = 3
): CellTower[] {
  if (towers.length === 0) return [];

  const towersWithDistance = towers.map((tower) => ({
    tower,
    distance: calculateDistance(lat, lng, tower.lat, tower.lng),
  }));

  // Sort by distance and take the nearest N
  towersWithDistance.sort((a, b) => a.distance - b.distance);

  return towersWithDistance.slice(0, count).map((t) => t.tower);
}

/**
 * Generate spider-leg polyline coordinates
 * Returns an array of [lat, lng] pairs for drawing lines from a point to towers
 */
export function generateSpiderLegs(
  centerLat: number,
  centerLng: number,
  towers: CellTower[]
): Array<[[number, number], [number, number]]> {
  return towers.map((tower) => [
    [centerLat, centerLng],
    [tower.lat, tower.lng],
  ]);
}

/**
 * Get the icon type for a tower based on its type
 */
export function getTowerIcon(type: "4G" | "5G"): string {
  // Lucide icon names
  return type === "5G" ? "zap" : "antenna";
}

/**
 * Format tower info for display
 */
export function formatTowerInfo(tower: CellTower): string {
  return `${tower.type} Tower (Cell ID: ${tower.cellId})`;
}

/**
 * Filter towers within a bounding box
 */
export function filterTowersInBounds(
  towers: CellTower[],
  north: number,
  south: number,
  east: number,
  west: number
): CellTower[] {
  return towers.filter((tower) => {
    return (
      tower.lat >= south &&
      tower.lat <= north &&
      tower.lng >= west &&
      tower.lng <= east
    );
  });
}

/**
 * Group towers by type for statistics
 */
export function groupTowersByType(
  towers: CellTower[]
): Record<"4G" | "5G", number> {
  const counts = { "4G": 0, "5G": 0 };

  for (const tower of towers) {
    counts[tower.type]++;
  }

  return counts;
}

/**
 * Calculate average distance from a point to all provided towers
 */
export function calculateAverageTowerDistance(
  lat: number,
  lng: number,
  towers: CellTower[]
): number {
  if (towers.length === 0) return 0;

  const totalDistance = towers.reduce(
    (sum, tower) => sum + calculateDistance(lat, lng, tower.lat, tower.lng),
    0
  );

  return totalDistance / towers.length;
}
