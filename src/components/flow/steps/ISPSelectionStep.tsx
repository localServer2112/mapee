"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Check, Wifi, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ISP_LIST } from "@/lib/constants";
import { useASNLookup } from "@/hooks/useASNLookup";
import { cn } from "@/lib/utils";

interface ISPSelectionStepProps {
  onSelect: (isp: string) => void;
}

export default function ISPSelectionStep({ onSelect }: ISPSelectionStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedISP, setSelectedISP] = useState<string | null>(null);
  const { asnInfo, isLoading: isDetecting, lookup } = useASNLookup();

  // Auto-detect ISP on mount
  useEffect(() => {
    lookup();
  }, [lookup]);

  // Filter ISPs based on search query
  const filteredISPs = ISP_LIST.filter((isp) =>
    isp.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (isp: string) => {
    setSelectedISP(isp);
  };

  const handleContinue = () => {
    if (selectedISP) {
      onSelect(selectedISP);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4"
    >
      <h2 className="text-xl font-semibold text-white mb-2 text-center">
        Select Your ISP
      </h2>
      <p className="text-sm text-slate-400 mb-4 text-center">
        Choose your internet service provider
      </p>

      {/* Auto-detected ISP */}
      {(isDetecting || asnInfo) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
        >
          <div className="flex items-center gap-2 text-sm">
            {isDetecting ? (
              <>
                <Loader2 className="w-4 h-4 text-ping-good animate-spin" />
                <span className="text-slate-400">Detecting your ISP...</span>
              </>
            ) : asnInfo ? (
              <>
                <Wifi className="w-4 h-4 text-ping-good" />
                <span className="text-slate-400">Detected:</span>
                <span className="text-white font-medium">{asnInfo.isp}</span>
                <Button
                  variant="link"
                  size="sm"
                  className="text-ping-good p-0 h-auto ml-auto"
                  onClick={() => handleSelect(asnInfo.isp)}
                >
                  Use this
                </Button>
              </>
            ) : null}
          </div>
        </motion.div>
      )}

      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search ISPs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-slate-800/50 border-slate-700 text-white"
        />
      </div>

      {/* ISP List */}
      <div className="max-h-48 overflow-y-auto space-y-1 mb-4 pr-1">
        {filteredISPs.map((isp, index) => (
          <motion.button
            key={isp}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => handleSelect(isp)}
            className={cn(
              "w-full px-4 py-2.5 rounded-lg text-left text-sm transition-colors",
              "flex items-center justify-between",
              selectedISP === isp
                ? "bg-ping-good/20 text-white border border-ping-good/50"
                : "bg-slate-800/30 text-slate-300 hover:bg-slate-700/50 border border-transparent"
            )}
          >
            <span>{isp}</span>
            {selectedISP === isp && (
              <Check className="w-4 h-4 text-ping-good" />
            )}
          </motion.button>
        ))}

        {filteredISPs.length === 0 && (
          <div className="text-center py-4 text-slate-400 text-sm">
            No ISPs found. Try a different search.
          </div>
        )}
      </div>

      {/* Continue button */}
      <Button
        onClick={handleContinue}
        disabled={!selectedISP}
        className="w-full bg-ping-good hover:bg-ping-good/90 text-white disabled:opacity-50"
      >
        Continue
      </Button>
    </motion.div>
  );
}
