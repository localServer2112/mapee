"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { FlowStep } from "@/types";
import { cn } from "@/lib/utils";

interface FlowProgressProps {
  currentStep: FlowStep;
  className?: string;
}

const steps: { key: FlowStep; label: string }[] = [
  { key: "location", label: "LOC" },
  { key: "isp", label: "ISP" },
  { key: "testing", label: "TEST" },
  { key: "success", label: "DONE" },
];

export default function FlowProgress({
  currentStep,
  className,
}: FlowProgressProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className={cn("flex items-center justify-between px-4", className)}>
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            {/* Step circle */}
            <motion.div
              initial={false}
              animate={{
                scale: isCurrent ? 1.1 : 1,
                backgroundColor: isComplete
                  ? "#00FF88"
                  : isCurrent
                  ? "#00FFFF"
                  : "#1a2632",
              }}
              className={cn(
                "w-8 h-8 rounded-sm flex items-center justify-center",
                "border transition-colors font-mono",
                isComplete
                  ? "border-neon-green"
                  : isCurrent
                  ? "border-neon-cyan"
                  : "border-cyber-border"
              )}
            >
              {isComplete ? (
                <Check className="w-4 h-4 text-black" />
              ) : (
                <span
                  className={cn(
                    "text-sm font-bold",
                    isCurrent ? "text-black" : "text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
              )}
            </motion.div>

            {/* Step label */}
            <span
              className={cn(
                "ml-2 text-xs hidden sm:block font-mono",
                isCurrent ? "text-neon-cyan font-medium" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="w-8 sm:w-12 h-px mx-2 sm:mx-4 bg-cyber-border overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: isComplete ? "100%" : "0%" }}
                  className="h-full bg-neon-green"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
