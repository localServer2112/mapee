"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useGeocode } from "@/hooks/useGeocode";
import { GeocodeResult } from "@/types";
import { cn } from "@/lib/utils";

interface LocationSearchProps {
  onSelect: (result: GeocodeResult) => void;
  className?: string;
}

export default function LocationSearch({
  onSelect,
  className,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { results, isLoading, search, clear } = useGeocode();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      clear();
      return;
    }

    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search, clear]);

  const handleSelect = useCallback(
    (result: GeocodeResult) => {
      setQuery(result.displayName.split(",")[0]);
      setIsOpen(false);
      clear();
      onSelect(result);
    },
    [onSelect, clear]
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay to allow click on results
    setTimeout(() => setIsOpen(false), 200);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-cyan" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search location..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="pl-9 pr-9 bg-cyber-dark border-cyber-border text-foreground placeholder:text-muted-foreground font-mono"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-cyan animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 cyber-panel rounded-sm shadow-xl overflow-hidden z-50"
          >
            {results.map((result, index) => (
              <motion.button
                key={`${result.lat}-${result.lng}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelect(result)}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-cyber-border transition-colors text-left border-b border-cyber-border last:border-b-0"
              >
                <MapPin className="w-4 h-4 text-neon-green mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate font-mono">
                    {result.displayName.split(",")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {result.displayName.split(",").slice(1).join(",").trim()}
                  </p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
