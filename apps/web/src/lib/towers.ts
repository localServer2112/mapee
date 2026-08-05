// Moved to @mapee/core. Re-exported so existing `@/lib/towers` imports keep
// working.
export {
  calculateDistance,
  findNearestTowers,
  generateSpiderLegs,
  getTowerIcon,
  formatTowerInfo,
  filterTowersInBounds,
  groupTowersByType,
  calculateAverageTowerDistance,
} from "@mapee/core";
