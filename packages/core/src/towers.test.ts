import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  findNearestTowers,
  generateSpiderLegs,
  filterTowersInBounds,
  groupTowersByType,
  calculateAverageTowerDistance,
} from "./towers";
import type { CellTower } from "./types";

function tower(overrides: Partial<CellTower> = {}): CellTower {
  return {
    id: "621-30-1-1",
    lat: 6.5244,
    lng: 3.3792,
    type: "4G",
    mcc: 621,
    mnc: 30,
    lac: 1,
    cellId: 1,
    ...overrides,
  };
}

describe("calculateDistance", () => {
  it("is zero for identical points", () => {
    expect(calculateDistance(6.5, 3.3, 6.5, 3.3)).toBe(0);
  });

  it("matches the known length of one degree of latitude", () => {
    // 1° of latitude is ~111.19 km on a sphere of radius 6371 km
    expect(calculateDistance(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });

  it("is symmetric", () => {
    const ab = calculateDistance(6.5244, 3.3792, 9.0765, 7.3986);
    const ba = calculateDistance(9.0765, 7.3986, 6.5244, 3.3792);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it("approximates the Lagos–Abuja great-circle distance", () => {
    const km = calculateDistance(6.5244, 3.3792, 9.0765, 7.3986);
    expect(km).toBeGreaterThan(520);
    expect(km).toBeLessThan(540);
  });
});

describe("findNearestTowers", () => {
  it("returns empty when there are no towers", () => {
    expect(findNearestTowers(6.5, 3.3, [])).toEqual([]);
  });

  it("returns the closest N in ascending distance order", () => {
    const towers = [
      tower({ id: "far", lat: 8.0, lng: 3.3792 }),
      tower({ id: "near", lat: 6.53, lng: 3.3792 }),
      tower({ id: "mid", lat: 7.0, lng: 3.3792 }),
    ];
    expect(findNearestTowers(6.5244, 3.3792, towers, 2).map((t) => t.id)).toEqual([
      "near",
      "mid",
    ]);
  });

  it("returns everything when asked for more than exist", () => {
    expect(findNearestTowers(6.5, 3.3, [tower()], 5)).toHaveLength(1);
  });
});

describe("generateSpiderLegs", () => {
  it("produces one origin-to-tower segment per tower", () => {
    const legs = generateSpiderLegs(6.5, 3.3, [
      tower({ lat: 6.6, lng: 3.4 }),
      tower({ lat: 6.7, lng: 3.5 }),
    ]);
    expect(legs).toEqual([
      [[6.5, 3.3], [6.6, 3.4]],
      [[6.5, 3.3], [6.7, 3.5]],
    ]);
  });

  it("produces nothing for no towers", () => {
    expect(generateSpiderLegs(6.5, 3.3, [])).toEqual([]);
  });
});

describe("filterTowersInBounds", () => {
  const inside = tower({ id: "inside", lat: 6.5, lng: 3.3 });
  const outside = tower({ id: "outside", lat: 9.0, lng: 7.0 });

  it("keeps only towers within the box", () => {
    const kept = filterTowersInBounds([inside, outside], 7, 6, 4, 3);
    expect(kept.map((t) => t.id)).toEqual(["inside"]);
  });

  it("treats bounds as inclusive", () => {
    const onEdge = tower({ id: "edge", lat: 7, lng: 4 });
    expect(filterTowersInBounds([onEdge], 7, 6, 4, 3)).toHaveLength(1);
  });
});

describe("groupTowersByType", () => {
  it("counts both radio types, including zeroes", () => {
    expect(groupTowersByType([])).toEqual({ "4G": 0, "5G": 0 });
    expect(
      groupTowersByType([tower({ type: "4G" }), tower({ type: "5G" }), tower({ type: "5G" })])
    ).toEqual({ "4G": 1, "5G": 2 });
  });
});

describe("calculateAverageTowerDistance", () => {
  it("returns 0 for no towers rather than dividing by zero", () => {
    expect(calculateAverageTowerDistance(6.5, 3.3, [])).toBe(0);
  });

  it("averages the distances", () => {
    const avg = calculateAverageTowerDistance(0, 0, [
      tower({ lat: 1, lng: 0 }),
      tower({ lat: 3, lng: 0 }),
    ]);
    expect(avg).toBeCloseTo(calculateDistance(0, 0, 2, 0), 1);
  });
});
