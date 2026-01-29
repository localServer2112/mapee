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
  { key: "location", label: "Location" },
  { key: "isp", label: "ISP" },
  { key: "testing", label: "Test" },
  { key: "success", label: "Done" },
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
                  ? "#22c55e"
                  : isCurrent
                  ? "#22c55e"
                  : "#334155",
              }}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                "border-2 transition-colors",
                isComplete || isCurrent
                  ? "border-ping-good"
                  : "border-slate-600"
              )}
            >
              {isComplete ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <span
                  className={cn(
                    "text-sm font-medium",
                    isCurrent ? "text-white" : "text-slate-400"
                  )}
                >
                  {index + 1}
                </span>
              )}
            </motion.div>

            {/* Step label */}
            <span
              className={cn(
                "ml-2 text-xs hidden sm:block",
                isCurrent ? "text-white font-medium" : "text-slate-400"
              )}
            >
              {step.label}
            </span>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="w-8 sm:w-12 h-0.5 mx-2 sm:mx-4 bg-slate-600 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: isComplete ? "100%" : "0%" }}
                  className="h-full bg-ping-good"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
