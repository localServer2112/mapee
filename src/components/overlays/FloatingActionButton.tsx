"use client";

import { motion } from "framer-motion";
import { Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick: () => void;
  isOnline?: boolean;
  className?: string;
}

export default function FloatingActionButton({
  onClick,
  isOnline = true,
  className,
}: FloatingActionButtonProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", delay: 0.5 }}
      className={cn("fixed bottom-6 right-6 z-40", className)}
    >
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={onClick}
          size="lg"
          className={cn(
            "h-14 px-6 rounded-full shadow-lg",
            "bg-ping-good hover:bg-ping-good/90",
            "text-white font-semibold",
            "flex items-center gap-2",
            !isOnline && "bg-slate-600 hover:bg-slate-600"
          )}
        >
          <motion.div
            animate={isOnline ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Wifi className="w-5 h-5" />
          </motion.div>
          <span>Ping My Location</span>
        </Button>
      </motion.div>

      {/* Pulse ring effect */}
      {isOnline && (
        <motion.div
          className="absolute inset-0 rounded-full bg-ping-good/30"
          animate={{
            scale: [1, 1.5],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      )}
    </motion.div>
  );
}
