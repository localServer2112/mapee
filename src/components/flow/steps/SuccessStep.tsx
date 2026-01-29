"use client";

import { motion } from "framer-motion";
import { CheckCircle, Share2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLatencyStatus, getLatencyColor, getLatencyLabel } from "@/lib/latency";
import { useToast } from "@/hooks/use-toast";

interface SuccessStepProps {
  latencyMs: number;
  jitter: number;
  isp: string;
  onConfirm: () => void;
}

export default function SuccessStep({
  latencyMs,
  jitter,
  isp,
  onConfirm,
}: SuccessStepProps) {
  const { toast } = useToast();
  const status = getLatencyStatus(latencyMs);
  const color = getLatencyColor(status);
  const label = getLatencyLabel(status);

  const handleShare = async () => {
    const shareText = `I just tested my network with Mapee! ${isp}: ${latencyMs}ms (${label}) 📶`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mapee Network Test",
          text: shareText,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareText);
      toast({
        title: "Copied to clipboard!",
        description: "Share your result with the community",
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
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: `${color}20` }}
      >
        <CheckCircle className="w-12 h-12" style={{ color }} />
      </motion.div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-white mb-2 text-center">
        Test Complete!
      </h2>
      <p className="text-sm text-slate-400 mb-6 text-center">
        Your data helps improve network visibility
      </p>

      {/* Results card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 mb-6"
      >
        {/* Latency */}
        <div className="text-center mb-4">
          <p className="text-5xl font-bold" style={{ color }}>
            {latencyMs}
            <span className="text-2xl">ms</span>
          </p>
          <p className="text-sm mt-1" style={{ color }}>
            {label} Connection
          </p>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">ISP</p>
            <p className="text-white font-medium truncate">{isp}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Jitter</p>
            <p className="text-white font-medium">±{jitter}ms</p>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="w-full space-y-3">
        <Button
          onClick={onConfirm}
          className="w-full bg-ping-good hover:bg-ping-good/90 text-white"
        >
          <MapPin className="w-4 h-4 mr-2" />
          Add to Map
        </Button>

        <Button
          variant="outline"
          onClick={handleShare}
          className="w-full border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share to Community
        </Button>
      </div>

      {/* Thank you message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-slate-500 mt-6 text-center"
      >
        Thank you for contributing to the network map! 🌐
      </motion.p>
    </motion.div>
  );
}
