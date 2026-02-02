"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ConfidenceScoreProps {
  score: number;
  className?: string;
}

export default function ConfidenceScore({
  score,
  className,
}: ConfidenceScoreProps) {
  // Determine color based on score - using neon colors
  const getScoreColor = () => {
    if (score >= 70) return "#00FF88"; // Neon green
    if (score >= 40) return "#FFD600"; // Neon yellow
    return "#FF3366"; // Neon red
  };

  const getScoreLabel = () => {
    if (score >= 70) return "HIGH";
    if (score >= 40) return "MEDIUM";
    return "LOW";
  };

  const color = getScoreColor();
  const label = getScoreLabel();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-3 p-3 cyber-card",
        className
      )}
    >
      <div
        className="w-12 h-12 rounded-sm flex items-center justify-center"
        style={{ backgroundColor: `${color}15` }}
      >
        <ShieldCheck className="w-6 h-6" style={{ color }} />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground font-mono">TRUST SCORE</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] bg-cyber-dark border-cyber-border">
                <p className="text-xs">
                  Based on number of scans, data consistency, and freshness.
                  Higher scores indicate more reliable data.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-bold font-mono" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{label}</span>
        </div>
      </div>

      {/* Progress ring */}
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 -rotate-90">
          {/* Background circle */}
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-cyber-border"
          />
          {/* Progress circle */}
          <motion.circle
            cx="24"
            cy="24"
            r="20"
            stroke={color}
            strokeWidth="3"
            fill="none"
            strokeLinecap="square"
            initial={{ strokeDasharray: "0 126" }}
            animate={{
              strokeDasharray: `${(score / 100) * 126} 126`,
            }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
      </div>
    </motion.div>
  );
}
