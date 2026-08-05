"use client";

import { useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { PingLog } from "@/types";
import { getLatencyStatus } from "@/lib/latency";

interface HeatmapLayerProps {
  pingLogs: PingLog[];
  intensity?: number;
  radius?: number;
  blur?: number;
}

/**
 * Canvas-based heatmap layer for ping visualization
 * Uses a custom gradient based on latency values
 */
export default function HeatmapLayer({
  pingLogs,
  intensity = 0.6,
  radius = 25,
  blur = 15,
}: HeatmapLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (pingLogs.length === 0) {
      // Remove existing layer if no data
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    // Create canvas overlay
    const HeatmapOverlay = L.Layer.extend({
      onAdd: function (map: L.Map) {
        this._map = map;
        this._canvas = L.DomUtil.create("canvas", "leaflet-heatmap-layer");
        const size = map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._canvas.style.position = "absolute";
        this._canvas.style.top = "0";
        this._canvas.style.left = "0";
        this._canvas.style.pointerEvents = "none";
        this._canvas.style.zIndex = "400";

        map.getPanes().overlayPane?.appendChild(this._canvas);

        map.on("moveend", this._redraw, this);
        map.on("zoomend", this._redraw, this);
        map.on("resize", this._resize, this);

        this._redraw();
      },

      onRemove: function (map: L.Map) {
        map.getPanes().overlayPane?.removeChild(this._canvas);
        map.off("moveend", this._redraw, this);
        map.off("zoomend", this._redraw, this);
        map.off("resize", this._resize, this);
      },

      _resize: function () {
        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._redraw();
      },

      _redraw: function () {
        const ctx = this._canvas.getContext("2d");
        if (!ctx) return;

        const size = this._map.getSize();
        ctx.clearRect(0, 0, size.x, size.y);

        const bounds = this._map.getBounds();
        const zoom = this._map.getZoom();

        // Adjust radius based on zoom level
        const adjustedRadius = Math.max(10, radius * (zoom / 12));
        const adjustedBlur = Math.max(5, blur * (zoom / 12));

        // Draw each point
        pingLogs.forEach((log) => {
          const point = this._map.latLngToContainerPoint([log.lat, log.lng]);

          // Skip if outside bounds
          if (
            point.x < -adjustedRadius ||
            point.y < -adjustedRadius ||
            point.x > size.x + adjustedRadius ||
            point.y > size.y + adjustedRadius
          ) {
            return;
          }

          // Get color based on latency
          const status = getLatencyStatus(log.latencyMs);
          const colors = {
            good: { r: 0, g: 255, b: 136 }, // neon-green
            fair: { r: 255, g: 214, b: 0 }, // neon-yellow
            poor: { r: 255, g: 51, b: 102 }, // neon-red
          };
          const color = colors[status];

          // Create radial gradient
          const gradient = ctx.createRadialGradient(
            point.x,
            point.y,
            0,
            point.x,
            point.y,
            adjustedRadius
          );

          gradient.addColorStop(
            0,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity})`
          );
          gradient.addColorStop(
            0.5,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity * 0.5})`
          );
          gradient.addColorStop(
            1,
            `rgba(${color.r}, ${color.g}, ${color.b}, 0)`
          );

          ctx.beginPath();
          ctx.arc(point.x, point.y, adjustedRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        });

        // Apply blur effect
        if (adjustedBlur > 0) {
          ctx.filter = `blur(${adjustedBlur}px)`;
          const imageData = ctx.getImageData(0, 0, size.x, size.y);
          ctx.putImageData(imageData, 0, 0);
          ctx.filter = "none";
        }
      },
    });

    // Remove existing layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    // Add new layer
    const heatmapLayer = new HeatmapOverlay();
    heatmapLayer.addTo(map);
    layerRef.current = heatmapLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [pingLogs, map, intensity, radius, blur]);

  return null;
}
