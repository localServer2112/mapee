"use client";

import { useEffect, useState } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderBarProps {
  isOnline: boolean;
  scanCount: number;
  className?: string;
}

export default function HeaderBar({
  isOnline,
  scanCount,
  className,
}: HeaderBarProps) {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-40 h-12",
        "bg-cyber-black/95 border-b border-cyber-border",
        "flex items-center justify-between px-4",
        "font-mono text-sm",
        className
      )}
    >
      {/* Left: Logo and App Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-cyan" />
          <span className="text-neon-cyan font-bold tracking-wider">MAPEE</span>
        </div>
        <span className="text-muted-foreground text-xs hidden sm:inline">
          NETWORK.MAP
        </span>
      </div>

      {/* Center: Status indicators */}
      <div className="flex items-center gap-4">
        {/* Scan count */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs uppercase">Scans</span>
          <span className="text-neon-green font-bold">{scanCount}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-cyber-border hidden sm:block" />

        {/* Online status */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <div className="status-dot-online" />
              <Wifi className="w-4 h-4 text-neon-green" />
              <span className="text-neon-green text-xs hidden sm:inline">ONLINE</span>
            </>
          ) : (
            <>
              <div className="status-dot-offline" />
              <WifiOff className="w-4 h-4 text-neon-red" />
              <span className="text-neon-red text-xs hidden sm:inline">OFFLINE</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Time */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-xs hidden sm:inline">SYS.TIME</span>
        <span className="text-neon-cyan tabular-nums">{currentTime}</span>
      </div>
    </header>
  );
}
