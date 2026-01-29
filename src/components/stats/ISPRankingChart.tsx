"use client";

import { motion } from "framer-motion";
import { HexBin } from "@/types";
import { getISPRankings } from "@/lib/confidence";
import { getLatencyStatus, getLatencyColor } from "@/lib/latency";
import { cn } from "@/lib/utils";

interface ISPRankingChartProps {
  hexbin: HexBin;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export default function ISPRankingChart({
  hexbin,
  className,
}: ISPRankingChartProps) {
  const rankings = getISPRankings(hexbin.pings);

  if (rankings.length === 0) {
    return (
      <div className={cn("text-center text-slate-400 py-4", className)}>
        No ISP data available
      </div>
    );
  }

  // Find max latency for bar scaling
  const maxLatency = Math.max(...rankings.map((r) => r.avgLatency));

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("space-y-3", className)}
    >
      <h4 className="text-sm font-medium text-slate-300 mb-3">
        ISP Rankings (Fastest First)
      </h4>

      {rankings.map((ranking, index) => {
        const status = getLatencyStatus(ranking.avgLatency);
        const color = getLatencyColor(status);
        const barWidth = (ranking.avgLatency / maxLatency) * 100;

        return (
          <motion.div key={ranking.isp} variants={itemVariants}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 w-5">
                  #{index + 1}
                </span>
                <span className="text-sm text-white truncate max-w-[120px]">
                  {ranking.isp}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">{ranking.count} scans</span>
                <span
                  className="font-semibold"
                  style={{ color }}
                >
                  {ranking.avgLatency}ms
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
