"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HexBin } from "@/types";
import { getLatencyStatus, getLatencyLabel } from "@/lib/latency";
import StatsGrid from "@/components/stats/StatsGrid";
import ISPRankingChart from "@/components/stats/ISPRankingChart";
import ConfidenceScore from "@/components/stats/ConfidenceScore";

interface AreaSummarySheetProps {
  hexbin: HexBin | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AreaSummarySheet({
  hexbin,
  isOpen,
  onClose,
}: AreaSummarySheetProps) {
  if (!hexbin) return null;

  const status = getLatencyStatus(hexbin.avgLatency);
  const statusLabel = getLatencyLabel(status);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[85vh] bg-cyber-black border-t border-neon-cyan/30 rounded-t-sm"
      >
        <SheetHeader className="pb-4 border-b border-cyber-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-neon-green/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-neon-green" />
              </div>
              <div>
                <SheetTitle className="text-neon-cyan text-lg font-mono">
                  NETWORK HEALTH
                </SheetTitle>
                <p className="text-sm text-muted-foreground font-mono">
                  {hexbin.pings.length} scans in this area
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-neon-cyan"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <StatsGrid hexbin={hexbin} />

              {/* Confidence Score */}
              <ConfidenceScore score={hexbin.confidence} />

              {/* Status Banner */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="p-4 cyber-card"
              >
                <p className="text-sm text-muted-foreground font-mono">
                  <span className="font-bold text-foreground">
                    {hexbin.consistency}%
                  </span>{" "}
                  of users reported{" "}
                  <span className="font-bold text-neon-green">
                    {statusLabel}
                  </span>{" "}
                  signal quality in this area.
                </p>
              </motion.div>

              {/* ISP Rankings */}
              <ISPRankingChart hexbin={hexbin} />

              {/* Sample Info */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-muted-foreground text-center pt-4 border-t border-cyber-border font-mono"
              >
                Based on {hexbin.pings.length} scan
                {hexbin.pings.length !== 1 ? "s" : ""} from the community
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
