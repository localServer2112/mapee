"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GlassOverlayProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
}

export default function GlassOverlay({
  children,
  isOpen,
  onClose,
  title,
  className,
}: GlassOverlayProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Glass Card */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "relative z-10 w-full sm:max-w-md mx-4 mb-4 sm:mb-0",
          "bg-slate-900/90 backdrop-blur-xl",
          "border border-slate-700/50",
          "rounded-2xl shadow-2xl",
          "overflow-hidden",
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Close button (if no title) */}
        {!title && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        )}

        {/* Content */}
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}
