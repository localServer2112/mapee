"use client";

import { useState, useCallback } from "react";
import { GeocodeResult } from "@/types";
import { API_URLS } from "@/lib/constants";

interface UseGeocodeReturn {
  results: GeocodeResult[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => Promise<GeocodeResult[]>;
  clear: () => void;
}

export function useGeocode(): UseGeocodeReturn {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string): Promise<GeocodeResult[]> => {
    if (!query.trim()) {
      setResults([]);
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: query, countrycodes: "ng" });
      const response = await fetch(`${API_URLS.GEOCODE}?${params}`);

      if (!response.ok) {
        throw new Error("Failed to geocode location");
      }

      const data: GeocodeResult[] = await response.json();
      setResults(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setResults([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isLoading,
    error,
    search,
    clear,
  };
}
