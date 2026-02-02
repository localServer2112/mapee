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
      {/* Backdrop - darker, minimal blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Cyber Panel */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "relative z-10 w-full sm:max-w-md mx-4 mb-4 sm:mb-0",
          "bg-cyber-black",
          "border border-neon-cyan/20",
          "rounded-sm shadow-2xl",
          "overflow-hidden",
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-cyber-border">
            <h2 className="text-lg font-semibold text-neon-cyan font-mono">{title}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-neon-cyan"
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
            className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-neon-cyan"
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
