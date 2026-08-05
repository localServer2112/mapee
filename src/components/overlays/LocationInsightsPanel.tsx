"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Activity, Radio, ShieldCheck, Database } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PingLog, CellTower, MapBounds } from "@/types";
import { getLatencyStatus, getLatencyLabel } from "@/lib/latency";
import { calculateWeightedAverageLatency, calculateConfidenceScore } from "@/lib/confidence";

interface LocationInsightsPanelProps {
  locationName: string | null;
  bounds: MapBounds | null;
  logs: PingLog[];
  towers: CellTower[];
  isOpen: boolean;
  onClose: () => void;
}

function getStatusColor(latency: number): string {
  if (latency === 0) return "text-muted-foreground";
  if (latency <= 50) return "text-neon-green";
  if (latency <= 150) return "text-neon-yellow";
  return "text-neon-red";
}

function generateInsightSummary(
  latency: number, 
  scans: number, 
  confidence: number, 
  towers: number
): string {
  if (scans === 0) {
    return "There is currently no network scan data available for this area. Be the first to initialize a scan and help map this location!";
  }

  const latencyDesc = latency <= 50 ? "excellent" : latency <= 150 ? "average" : "poor";
  const confidenceDesc = confidence > 75 ? "high" : confidence >= 40 ? "moderate" : "low";
  
  let towerDesc = "";
  if (towers === 0) {
    towerDesc = "Currently, no cell towers have been detected in this immediate vicinity, which suggests potential coverage gaps, signal degradation indoors, or reliance on distant infrastructure.";
  } else if (towers < 4) {
    towerDesc = `Additionally, there ${towers === 1 ? 'is' : 'are'} ${towers} cell tower${towers !== 1 ? 's' : ''} detected nearby. This indicates that core network infrastructure is present, though coverage redundancy and peak-load handling might be limited compared to denser grids.`;
  } else {
    towerDesc = `Additionally, an impressive ${towers} cell towers were detected nearby. This high density of infrastructure typically translates to robust signal penetration, excellent load balancing during peak hours, and highly reliable connection stability for multiple devices in this area.`;
  }
  
  return `This location exhibits ${latencyDesc} network performance with an average latency of ${latency}ms. Based on ${scans} community scan${scans !== 1 ? 's' : ''}, the data integrity is considered ${confidenceDesc} (${confidence}%). ${towerDesc}`;
}

export default function LocationInsightsPanel({
  locationName,
  bounds,
  logs,
  towers,
  isOpen,
  onClose,
}: LocationInsightsPanelProps) {
  if (!locationName) return null;

  // Render the panel but compute data strictly for the current bounds
  const activeLogs = logs.filter(
    (log) =>
      bounds &&
      log.lat >= bounds.south &&
      log.lat <= bounds.north &&
      log.lng >= bounds.west &&
      log.lng <= bounds.east
  );

  const activeTowers = towers.filter(
    (tower) =>
      bounds &&
      tower.lat >= bounds.south &&
      tower.lat <= bounds.north &&
      tower.lng >= bounds.west &&
      tower.lng <= bounds.east
  );

  const avgLatency = calculateWeightedAverageLatency(activeLogs);
  const confidenceScore = calculateConfidenceScore(activeLogs);
  const status = getLatencyStatus(avgLatency);
  const statusLabel = avgLatency > 0 ? getLatencyLabel(status) : "No Data";
  const statusColor = getStatusColor(avgLatency);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[65vh] sm:h-[100vh] sm:w-[400px] sm:max-w-[400px] sm:right-0 sm:left-auto sm:top-0 sm:bottom-0 bg-cyber-black border-t sm:border-t-0 sm:border-l border-neon-cyan/30 rounded-t-sm sm:rounded-none z-[70] shadow-2xl"
      >
        <SheetHeader className="pb-4 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-neon-cyan/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-neon-cyan" />
            </div>
            <div className="text-left w-full overflow-hidden">
              <SheetTitle className="text-neon-cyan text-lg font-mono truncate">
                {locationName}
              </SheetTitle>
              <p className="text-sm text-muted-foreground font-mono">
                Area Network Insights
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-4 overflow-y-auto max-h-[calc(100vh-100px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Insight Summary Paragraph */}
              <div className="cyber-panel p-4 bg-cyber-dark/50 border-neon-cyan/20">
                <p className="text-sm text-gray-300 font-sans leading-relaxed">
                  {generateInsightSummary(avgLatency, activeLogs.length, confidenceScore, activeTowers.length)}
                </p>
              </div>

              {/* Stat Card 1: Network Strength */}
              <div className="cyber-panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-neon-green" />
                  <div>
                    <h4 className="text-xs font-mono uppercase text-muted-foreground">Network Strength</h4>
                    <span className={`font-mono font-bold ${statusColor}`}>
                      {avgLatency > 0 ? `${avgLatency}ms (${statusLabel})` : "Insufficient Data"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat Card 2: Total Scans */}
              <div className="cyber-panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-neon-purple" />
                  <div>
                    <h4 className="text-xs font-mono uppercase text-muted-foreground">Total Scans</h4>
                    <span className="font-mono font-bold text-gray-200">
                      {activeLogs.length} logged
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat Card 3: Scan Integrity */}
              <div className="cyber-panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-neon-yellow" />
                  <div>
                    <h4 className="text-xs font-mono uppercase text-muted-foreground">Scan Integrity</h4>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-200">
                        {confidenceScore}% Confidence
                      </span>
                      {confidenceScore > 75 && <span className="text-[10px] bg-neon-green/20 text-neon-green px-1.5 py-0.5 rounded uppercase">High</span>}
                      {confidenceScore <= 75 && confidenceScore >= 40 && <span className="text-[10px] bg-neon-yellow/20 text-neon-yellow px-1.5 py-0.5 rounded uppercase">Med</span>}
                      {confidenceScore < 40 && <span className="text-[10px] bg-neon-red/20 text-neon-red px-1.5 py-0.5 rounded uppercase">Low</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stat Card 4: Cell Tower Availability */}
              <div className="cyber-panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Radio className="w-5 h-5 text-neon-cyan" />
                  <div>
                    <h4 className="text-xs font-mono uppercase text-muted-foreground">Cell Towers</h4>
                    <span className="font-mono font-bold text-gray-200">
                      {activeTowers.length > 0 ? `${activeTowers.length} Detected` : "None Detected"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 px-2">
                <p className="text-xs text-muted-foreground text-center font-mono leading-relaxed">
                  Insights recalculate dynamically based on the current map view area. Try panning or zooming to explore surrounding networks.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
