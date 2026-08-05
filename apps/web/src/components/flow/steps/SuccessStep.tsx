"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Link2, MapPin, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLatencyStatus, getLatencyColor, getLatencyLabel } from "@/lib/latency";
import { useToast } from "@/hooks/use-toast";

interface SuccessStepProps {
  latencyMs: number;
  jitter: number;
  uploadSpeed: number;
  downloadSpeed: number;
  isp: string;
  pingId: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function SuccessStep({
  latencyMs,
  jitter,
  uploadSpeed,
  downloadSpeed,
  isp,
  pingId,
  onConfirm,
  onClose,
}: SuccessStepProps) {
  const [stepState, setStepState] = useState<"results" | "thank-you">("results");
  const { toast } = useToast();
  const status = getLatencyStatus(latencyMs);
  const color = getLatencyColor(status);
  const label = getLatencyLabel(status);

  const handleCopyReportLink = async () => {
    const reportUrl = `${window.location.origin}/report/${pingId}`;
    try {
      await navigator.clipboard.writeText(reportUrl);
      toast({
        title: "Report link copied!",
        description: "Share this link after adding to map",
      });
    } catch {
      // Fallback for older browsers
      toast({
        title: "Report link",
        description: reportUrl,
      });
    }
  };

  const handleAddSubmit = () => {
    onConfirm();
    setStepState("thank-you");
  };

  return (
    <AnimatePresence mode="wait">
      {stepState === "results" ? (
        <motion.div
          key="results"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="flex flex-col items-center py-4"
        >
          {/* Success icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 rounded-sm flex items-center justify-center mb-6 border"
            style={{ backgroundColor: `${color}15`, borderColor: `${color}50` }}
          >
            <CheckCircle className="w-12 h-12" style={{ color }} />
          </motion.div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-2 text-center font-mono">
            TEST COMPLETE
          </h2>
          <p className="text-sm text-muted-foreground mb-6 text-center">
            Review your network test data
          </p>

          {/* Results card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full p-4 cyber-card mb-6"
          >
            {/* Latency */}
            <div className="text-center mb-4">
              <p className="text-5xl font-bold font-mono" style={{ color }}>
                {latencyMs}
                <span className="text-2xl">ms</span>
              </p>
              <p className="text-sm mt-1 font-mono" style={{ color }}>
                {label.toUpperCase()} CONNECTION
              </p>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-cyber-dark rounded-sm p-3 border border-cyber-border">
                <p className="text-muted-foreground text-xs mb-1 font-mono">ISP</p>
                <p className="text-foreground font-bold truncate font-mono">{isp}</p>
              </div>
              <div className="bg-cyber-dark rounded-sm p-3 border border-cyber-border">
                <p className="text-muted-foreground text-xs mb-1 font-mono">JITTER</p>
                <p className="text-foreground font-bold font-mono">±{jitter}ms</p>
              </div>
              <div className="bg-cyber-dark rounded-sm p-3 border border-cyber-border">
                <p className="text-muted-foreground text-xs mb-1 font-mono">DOWNLOAD</p>
                <p className="text-foreground font-bold font-mono">{downloadSpeed} Mbps</p>
              </div>
              <div className="bg-cyber-dark rounded-sm p-3 border border-cyber-border">
                <p className="text-muted-foreground text-xs mb-1 font-mono">UPLOAD</p>
                <p className="text-foreground font-bold font-mono">{uploadSpeed} Mbps</p>
              </div>
            </div>
          </motion.div>

          {/* Action buttons */}
          <div className="w-full space-y-3">
            <Button
              onClick={handleAddSubmit}
              className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold font-mono"
            >
              <MapPin className="w-4 h-4 mr-2" />
              ADD TO MAP
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="thank-you"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center py-8"
        >
          {/* Heart icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-neon-cyan/10 border border-neon-cyan/30 shadow-[0_0_30px_rgba(0,255,255,0.15)]"
          >
            <Heart className="w-12 h-12 text-neon-cyan fill-neon-cyan/50" />
          </motion.div>

          <h2 className="text-2xl font-bold mb-3 text-center font-mono text-neon-cyan tracking-wider">
            DATA ADDED!
          </h2>
          <p className="text-base text-muted-foreground mb-8 text-center max-w-[280px]">
            Thank you for contributing to the open network map. Your data helps everyone find better connections.
          </p>

          {/* Action buttons */}
          <div className="w-full space-y-4">
            <Button
              variant="cyber"
              onClick={handleCopyReportLink}
              className="w-full font-mono py-6 border-neon-cyan/50 hover:bg-neon-cyan/10"
            >
              <Link2 className="w-5 h-5 mr-3 text-neon-cyan" />
              COPY REPORT LINK
            </Button>

            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full font-mono text-muted-foreground hover:text-white"
            >
              CLOSE
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
