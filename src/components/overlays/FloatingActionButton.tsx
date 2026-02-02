"use client";

import { useState, useEffect } from "react";
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
  // Prevent hydration mismatch by only rendering animations after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render static version during SSR/hydration
  if (!mounted) {
    return (
      <div className={cn("fixed bottom-6 right-6 z-40", className)}>
        <Button
          onClick={onClick}
          size="lg"
          className={cn(
            "h-14 px-6 rounded-full",
            "bg-neon-green hover:bg-neon-green/90",
            "text-black font-semibold font-mono",
            "flex items-center gap-2",
            "shadow-neon-green"
          )}
        >
          <Wifi className="w-5 h-5" />
          <span>PING</span>
        </Button>
      </div>
    );
  }

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
            "h-14 px-6 rounded-full",
            "bg-neon-green hover:bg-neon-green/90",
            "text-black font-semibold font-mono",
            "flex items-center gap-2",
            "shadow-neon-green-lg transition-shadow",
            !isOnline && "bg-neon-red/80 hover:bg-neon-red/70 shadow-neon-red"
          )}
        >
          <motion.div
            animate={isOnline ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Wifi className="w-5 h-5" />
          </motion.div>
          <span>PING</span>
        </Button>
      </motion.div>

      {/* Pulse ring effect - cyan glow */}
      {isOnline && (
        <motion.div
          className="absolute inset-0 rounded-full bg-neon-cyan/20"
          animate={{
            scale: [1, 1.5],
            opacity: [0.4, 0],
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
