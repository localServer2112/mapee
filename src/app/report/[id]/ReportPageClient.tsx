"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Clock, Wifi, ArrowDown, ArrowUp, Activity, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ReportMap = dynamic(
  () => import("@/components/report/ReportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-cyber-dark flex items-center justify-center rounded-sm">
        <div className="w-6 h-6 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

interface ReportData {
  id: string;
  lat: number;
  lng: number;
  reportedISP: string;
  latencyMs: number;
  jitter: number;
  uploadSpeed: number;
  downloadSpeed: number;
  deviceType: string;
  createdAt: string;
}

interface ReportPageClientProps {
  report: ReportData;
  color: string;
  label: string;
  formattedDate: string;
}

export default function ReportPageClient({
  report,
  color,
  label,
  formattedDate,
}: ReportPageClientProps) {
  const { toast } = useToast();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied!",
        description: "Report URL copied to clipboard",
      });
    } catch {
      // silent fail
    }
  };

  return (
    <main className="min-h-screen bg-cyber-black text-foreground">
      {/* Header */}
      <header className="border-b border-cyber-border bg-cyber-dark/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-neon-green/10 border border-neon-green/30 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-neon-green" />
            </div>
            <span className="font-mono font-bold text-sm tracking-wider text-neon-cyan">
              MAPEE
            </span>
          </Link>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Network Report
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Latency Hero */}
        <div className="cyber-card p-6 text-center">
          <p className="text-6xl font-bold font-mono" style={{ color }}>
            {report.latencyMs}
            <span className="text-3xl">ms</span>
          </p>
          <p className="text-sm mt-2 font-mono" style={{ color }}>
            {label.toUpperCase()} CONNECTION
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="cyber-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-3.5 h-3.5 text-neon-cyan" />
              <p className="text-muted-foreground text-xs font-mono">ISP</p>
            </div>
            <p className="text-foreground font-bold font-mono truncate">
              {report.reportedISP}
            </p>
          </div>
          <div className="cyber-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-neon-cyan" />
              <p className="text-muted-foreground text-xs font-mono">JITTER</p>
            </div>
            <p className="text-foreground font-bold font-mono">
              ±{report.jitter}ms
            </p>
          </div>
          <div className="cyber-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDown className="w-3.5 h-3.5 text-neon-green" />
              <p className="text-muted-foreground text-xs font-mono">DOWNLOAD</p>
            </div>
            <p className="text-foreground font-bold font-mono">
              {report.downloadSpeed} Mbps
            </p>
          </div>
          <div className="cyber-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp className="w-3.5 h-3.5 text-neon-purple" />
              <p className="text-muted-foreground text-xs font-mono">UPLOAD</p>
            </div>
            <p className="text-foreground font-bold font-mono">
              {report.uploadSpeed} Mbps
            </p>
          </div>
        </div>

        {/* Mini Map */}
        <div className="cyber-card p-4">
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-3 font-mono">
            Approximate Location
          </p>
          <div className="w-full h-48 rounded-sm overflow-hidden border border-cyber-border">
            <ReportMap lat={report.lat} lng={report.lng} />
          </div>
        </div>

        {/* Verification Timestamp */}
        <div className="cyber-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-neon-yellow" />
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider font-mono">
              Verification Timestamp
            </p>
          </div>
          <p className="text-foreground text-sm font-mono">{formattedDate}</p>
          <p className="text-muted-foreground text-xs font-mono mt-1 capitalize">
            {report.deviceType} device
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="cyber"
            onClick={handleCopyLink}
            className="w-full font-mono"
          >
            <Link2 className="w-4 h-4 mr-2" />
            COPY REPORT LINK
          </Button>
          <Link href="/" className="block">
            <Button className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold font-mono">
              <Wifi className="w-4 h-4 mr-2" />
              TEST YOUR NETWORK
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50 font-mono pb-4">
          MAPEE &mdash; CROWDSOURCED NETWORK INTELLIGENCE
        </p>
      </div>
    </main>
  );
}
