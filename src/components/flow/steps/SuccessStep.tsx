"use client";

import { motion } from "framer-motion";
import { CheckCircle, Link2, MapPin } from "lucide-react";
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
}

export default function SuccessStep({
  latencyMs,
  jitter,
  uploadSpeed,
  downloadSpeed,
  isp,
  pingId,
  onConfirm,
}: SuccessStepProps) {
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
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
        Your data helps improve network visibility
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
          onClick={onConfirm}
          className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold font-mono"
        >
          <MapPin className="w-4 h-4 mr-2" />
          ADD TO MAP
        </Button>

        <Button
          variant="cyber"
          onClick={handleCopyReportLink}
          className="w-full font-mono"
        >
          <Link2 className="w-4 h-4 mr-2" />
          COPY REPORT LINK
        </Button>
      </div>

      {/* Thank you message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-muted-foreground mt-6 text-center font-mono"
      >
        THANK YOU FOR CONTRIBUTING TO THE NETWORK MAP
      </motion.p>
    </motion.div>
  );
}
