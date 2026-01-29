"use client";

import { useState, useCallback } from "react";
import { ASNInfo } from "@/types";
import { API_URLS } from "@/lib/constants";

interface UseASNLookupReturn {
  asnInfo: ASNInfo | null;
  isLoading: boolean;
  error: string | null;
  lookup: () => Promise<ASNInfo | null>;
}

export function useASNLookup(): UseASNLookupReturn {
  const [asnInfo, setAsnInfo] = useState<ASNInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (): Promise<ASNInfo | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_URLS.ASN);

      if (!response.ok) {
        throw new Error("Failed to lookup ASN info");
      }

      const data: ASNInfo = await response.json();
      setAsnInfo(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    asnInfo,
    isLoading,
    error,
    lookup,
  };
}
