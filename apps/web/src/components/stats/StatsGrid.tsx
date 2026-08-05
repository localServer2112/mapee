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
      label: "TOTAL SCANS",
      value: hexbin.pings.length.toString(),
      icon: Users,
      color: "text-neon-cyan",
    },
    {
      label: "AVG LATENCY",
      value: `${Math.round(hexbin.avgLatency)}ms`,
      icon: Activity,
      color: `text-[${statusColor}]`,
      style: { color: statusColor },
    },
    {
      label: "BEST ISP",
      value: hexbin.topISP,
      icon: Wifi,
      color: "text-neon-purple",
    },
    {
      label: "CONSISTENCY",
      value: `${hexbin.consistency}%`,
      icon: TrendingUp,
      color: "text-neon-green",
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
          className="cyber-card p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <stat.icon
              className={cn("w-4 h-4", stat.color)}
              style={stat.style}
            />
            <span className="text-xs text-muted-foreground font-mono">{stat.label}</span>
          </div>
          <p
            className="text-lg font-bold text-foreground truncate font-mono"
            style={stat.style}
          >
            {stat.value}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
