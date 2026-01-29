"use client";

import { motion } from "framer-motion";
import { Activity, Wifi, Users, TrendingUp } from "lucide-react";
import { HexBin } from "@/types";
import { getLatencyStatus, getLatencyColor, getLatencyLabel } from "@/lib/latency";
import { cn } from "@/lib/utils";

interface StatsGridProps {
  hexbin: HexBin;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function StatsGrid({ hexbin, className }: StatsGridProps) {
  const status = getLatencyStatus(hexbin.avgLatency);
  const statusColor = getLatencyColor(status);
  const statusLabel = getLatencyLabel(status);

  const stats = [
    {
      label: "Total Scans",
      value: hexbin.pings.length.toString(),
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: "Avg. Latency",
      value: `${Math.round(hexbin.avgLatency)}ms`,
      icon: Activity,
      color: `text-[${statusColor}]`,
      style: { color: statusColor },
    },
    {
      label: "Best Provider",
      value: hexbin.topISP,
      icon: Wifi,
      color: "text-purple-400",
    },
    {
      label: "Consistency",
      value: `${hexbin.consistency}%`,
      icon: TrendingUp,
      color: "text-green-400",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("grid grid-cols-2 gap-3", className)}
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          variants={itemVariants}
          className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
        >
          <div className="flex items-center gap-2 mb-1">
            <stat.icon
              className={cn("w-4 h-4", stat.color)}
              style={stat.style}
            />
            <span className="text-xs text-slate-400">{stat.label}</span>
          </div>
          <p
            className="text-lg font-semibold text-white truncate"
            style={stat.style}
          >
            {stat.value}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
