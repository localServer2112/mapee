"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Check, Wifi, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ISP_LIST } from "@/lib/constants";
import { useASNLookup } from "@/hooks/useASNLookup";
import { detectISP } from "@/lib/isp-verification";
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
    const detect = async () => {
      const info = await lookup();
      if (info) {
        const detected = detectISP(info);
        if (detected) {
          // Auto-select and verified match found
          setSelectedISP(detected);
        }
      }
    };
    detect();
  }, [lookup]);

  const detectedISP = asnInfo ? detectISP(asnInfo) : null;
  const isVerified = !!detectedISP;

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
      <h2 className="text-xl font-bold text-foreground mb-2 text-center font-mono">
        SELECT ISP
      </h2>
      <p className="text-sm text-muted-foreground mb-4 text-center">
        Choose your internet service provider
      </p>

      {/* Auto-detected ISP */}
      {(isDetecting || asnInfo) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "mb-4 p-3 border rounded-sm",
            isVerified
              ? "bg-neon-green/10 border-neon-green/30"
              : "bg-amber-500/10 border-amber-500/30"
          )}
        >
          <div className="flex flex-col gap-2 text-sm">
            {isDetecting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
                <span className="text-muted-foreground font-mono">VERIFYING CONNECTION...</span>
              </div>
            ) : asnInfo ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isVerified ? (
                      <Check className="w-4 h-4 text-neon-green" />
                    ) : (
                      <Wifi className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="text-muted-foreground font-mono text-xs uppercase">
                      {isVerified ? "VERIFIED ISP DETECTED" : "UNVERIFIED CONNECTION"}
                    </span>
                  </div>
                  {isVerified && (
                    <span className="px-2 py-0.5 bg-neon-green/20 text-neon-green text-[10px] font-bold rounded-sm border border-neon-green/30">
                      LOCKED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-foreground font-bold font-mono text-lg">
                    {isVerified ? detectedISP : asnInfo.isp}
                  </span>
                </div>

                {!isVerified && (
                  <p className="text-amber-500 text-xs mt-1">
                    Your connection ({asnInfo.isp}) does not match our listed providers.
                    Please ensure you are connected to the correct network.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </motion.div>
      )}

      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-cyan" />
        <Input
          type="text"
          placeholder="Search ISPs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 font-mono"
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
              "w-full px-4 py-2.5 rounded-sm text-left text-sm transition-colors font-mono",
              "flex items-center justify-between",
              selectedISP === isp
                ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/50"
                : "bg-cyber-dark text-muted-foreground border border-transparent",
              !isVerified && selectedISP !== isp && "hover:bg-cyber-border",
              // Disable other options if verified
              isVerified && selectedISP !== isp && "opacity-30 cursor-not-allowed hover:bg-transparent"
            )}
            disabled={isVerified && selectedISP !== isp}
          >
            <span>{isp}</span>
            {selectedISP === isp && (
              <Check className="w-4 h-4 text-neon-cyan" />
            )}
          </motion.button>
        ))}

        {filteredISPs.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm font-mono">
            NO ISPs FOUND
          </div>
        )}
      </div>

      {/* Continue button */}
      <Button
        onClick={handleContinue}
        disabled={!selectedISP}
        className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold font-mono disabled:opacity-50"
      >
        CONTINUE
      </Button>
    </motion.div>
  );
}
