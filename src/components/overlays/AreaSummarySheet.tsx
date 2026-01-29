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
        className="h-[85vh] bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 rounded-t-3xl"
      >
        <SheetHeader className="pb-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ping-good/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-ping-good" />
              </div>
              <div>
                <SheetTitle className="text-white text-lg">
                  Network Health
                </SheetTitle>
                <p className="text-sm text-slate-400">
                  {hexbin.pings.length} scans in this area
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
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
                className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50"
              >
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-white">
                    {hexbin.consistency}%
                  </span>{" "}
                  of users reported{" "}
                  <span className="font-semibold text-ping-good">
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
                className="text-xs text-slate-500 text-center pt-4 border-t border-slate-700/50"
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
