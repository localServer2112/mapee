"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FlowStep, Coordinates, PingLog } from "@/types";
import { detectDeviceType, getUserAgent } from "@/lib/speedtest";
import { generateId } from "@/lib/utils";
import GlassOverlay from "@/components/overlays/GlassOverlay";
import FlowProgress from "./FlowProgress";
import LocationStep from "./steps/LocationStep";
import ISPSelectionStep from "./steps/ISPSelectionStep";
import TestingStep from "./steps/TestingStep";
import SuccessStep from "./steps/SuccessStep";

interface NetworkTestFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (log: PingLog) => void;
  onLocationChange?: (coords: Coordinates | null) => void;
  onTestingStateChange?: (isTesting: boolean) => void;
}

export default function NetworkTestFlow({
  isOpen,
  onClose,
  onSubmit,
  onLocationChange,
  onTestingStateChange,
}: NetworkTestFlowProps) {
  const [step, setStep] = useState<FlowStep>("location");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [selectedISP, setSelectedISP] = useState<string>("");
  const [testResult, setTestResult] = useState<{
    latencyMs: number;
    jitter: number;
    uploadSpeed: number;
    downloadSpeed: number;
  } | null>(null);
  const [pingId, setPingId] = useState<string>("");

  const handleLocationGranted = (coords: Coordinates) => {
    setCoordinates(coords);
    onLocationChange?.(coords);
    setStep("isp");
  };

  const handleISPSelected = (isp: string) => {
    setSelectedISP(isp);
    setStep("testing");
    onTestingStateChange?.(true);
  };

  const handleTestComplete = (
    latencyMs: number,
    jitter: number,
    uploadSpeed: number,
    downloadSpeed: number
  ) => {
    setTestResult({ latencyMs, jitter, uploadSpeed, downloadSpeed });
    setPingId(generateId());
    onTestingStateChange?.(false);
    setStep("success");
  };

  const handleSubmit = () => {
    if (!coordinates || !testResult) return;

    const log: PingLog = {
      id: pingId,
      lat: coordinates.lat,
      lng: coordinates.lng,
      reportedISP: selectedISP,
      verifiedASN: null,
      latencyMs: testResult.latencyMs,
      jitter: testResult.jitter,
      uploadSpeed: testResult.uploadSpeed,
      downloadSpeed: testResult.downloadSpeed,
      timestamp: Date.now(),
      deviceType: detectDeviceType(),
      userAgent: getUserAgent(),
    };

    onSubmit(log);
    handleClose();
  };

  const handleClose = () => {
    // Reset state
    setStep("location");
    setCoordinates(null);
    setSelectedISP("");
    setTestResult(null);
    setPingId("");
    onLocationChange?.(null);
    onTestingStateChange?.(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <GlassOverlay isOpen={isOpen} onClose={handleClose}>
          {/* Progress indicator */}
          <FlowProgress currentStep={step} className="mb-6" />

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === "location" && (
                <LocationStep onGranted={handleLocationGranted} />
              )}
              {step === "isp" && (
                <ISPSelectionStep onSelect={handleISPSelected} />
              )}
              {step === "testing" && (
                <TestingStep onComplete={handleTestComplete} />
              )}
              {step === "success" && testResult && (
                <SuccessStep
                  latencyMs={testResult.latencyMs}
                  jitter={testResult.jitter}
                  uploadSpeed={testResult.uploadSpeed}
                  downloadSpeed={testResult.downloadSpeed}
                  isp={selectedISP}
                  pingId={pingId}
                  onConfirm={handleSubmit}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </GlassOverlay>
      )}
    </AnimatePresence>
  );
}
