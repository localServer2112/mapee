import { notFound } from "next/navigation";
import { Metadata } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { decryptCoordinate } from "@/lib/encryption";
import { getLatencyStatus, getLatencyColor, getLatencyLabel } from "@/lib/latency";
import ReportPageClient from "./ReportPageClient";

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

async function getReport(id: string): Promise<ReportData | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(id)) return null;

  const { data, error } = await supabase
    .from("ping_logs")
    .select(
      "id, lat_encrypted, lng_encrypted, lat_grid, lng_grid, reported_isp, latency_ms, jitter, upload_speed, download_speed, device_type, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  let lat: number;
  let lng: number;
  try {
    lat = await decryptCoordinate(data.lat_encrypted);
    lng = await decryptCoordinate(data.lng_encrypted);
  } catch {
    lat = data.lat_grid;
    lng = data.lng_grid;
  }

  return {
    id: data.id,
    lat,
    lng,
    reportedISP: data.reported_isp,
    latencyMs: data.latency_ms,
    jitter: data.jitter,
    uploadSpeed: Number(data.upload_speed),
    downloadSpeed: Number(data.download_speed),
    deviceType: data.device_type,
    createdAt: data.created_at,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return { title: "Report Not Found | MAPEE" };
  }

  const status = getLatencyStatus(report.latencyMs);
  const label = getLatencyLabel(status);

  return {
    title: `${report.reportedISP} - ${report.latencyMs}ms (${label}) | MAPEE Report`,
    description: `Network test result: ${report.reportedISP} with ${report.latencyMs}ms latency, ${report.downloadSpeed} Mbps download, ${report.uploadSpeed} Mbps upload.`,
    openGraph: {
      title: `MAPEE Network Report - ${report.latencyMs}ms`,
      description: `${report.reportedISP}: ${label} connection (${report.latencyMs}ms latency)`,
      type: "website",
    },
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    notFound();
  }

  const status = getLatencyStatus(report.latencyMs);
  const color = getLatencyColor(status);
  const label = getLatencyLabel(status);

  const formattedDate = new Date(report.createdAt).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  return (
    <ReportPageClient
      report={report}
      color={color}
      label={label}
      formattedDate={formattedDate}
    />
  );
}
