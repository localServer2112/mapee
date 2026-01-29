"use client";

import { useState, useCallback } from "react";
import { CellTower, MapBounds } from "@/types";
import { API_URLS } from "@/lib/constants";

interface UseNearbyTowersReturn {
  towers: CellTower[];
  isLoading: boolean;
  error: string | null;
  fetchTowers: (bounds: MapBounds) => Promise<CellTower[]>;
  clear: () => void;
}

export function useNearbyTowers(): UseNearbyTowersReturn {
  const [towers, setTowers] = useState<CellTower[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTowers = useCallback(
    async (bounds: MapBounds): Promise<CellTower[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
        const params = new URLSearchParams({ bbox });
        const response = await fetch(`${API_URLS.TOWERS}?${params}`);

        if (!response.ok) {
          throw new Error("Failed to fetch tower data");
        }

        const data: CellTower[] = await response.json();
        setTowers(data);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clear = useCallback(() => {
    setTowers([]);
    setError(null);
  }, []);

  return {
    towers,
    isLoading,
    error,
    fetchTowers,
    clear,
  };
}
