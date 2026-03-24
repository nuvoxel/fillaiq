"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { X, SwitchCamera, Camera, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CapturedColor = {
  hex: string;
  r: number;
  g: number;
  b: number;
};

/**
 * Extract dominant color around a tap point using k-means (k=3).
 * Ignores near-white and near-black clusters as background.
 */
function extractColorAtPoint(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  canvasWidth: number,
  canvasHeight: number
): CapturedColor {
  const radius = Math.floor(Math.min(canvasWidth, canvasHeight) * 0.08);
  const x0 = Math.max(0, Math.floor(px - radius));
  const y0 = Math.max(0, Math.floor(py - radius));
  const w = Math.min(radius * 2, canvasWidth - x0);
  const h = Math.min(radius * 2, canvasHeight - y0);

  const imageData = ctx.getImageData(x0, y0, w, h);
  const { data } = imageData;

  const pixels: [number, number, number][] = [];
  const cx = px - x0;
  const cy = py - y0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const i = (y * w + x) * 4;
        pixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }

  if (pixels.length === 0) {
    return { hex: "#808080", r: 128, g: 128, b: 128 };
  }

  const k = Math.min(3, pixels.length);
  const centroids: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i * pixels.length) / k);
    centroids.push([...pixels[idx]]);
  }

  const assignments = new Uint8Array(pixels.length);

  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let best = 0;
      for (let c = 0; c < k; c++) {
        const dr = pixels[i][0] - centroids[c][0];
        const dg = pixels[i][1] - centroids[c][1];
        const db = pixels[i][2] - centroids[c][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          best = c;
        }
      }
      assignments[i] = best;
    }

    for (let c = 0; c < k; c++) {
      let sr = 0,
        sg = 0,
        sb = 0,
        count = 0;
      for (let i = 0; i < pixels.length; i++) {
        if (assignments[i] === c) {
          sr += pixels[i][0];
          sg += pixels[i][1];
          sb += pixels[i][2];
          count++;
        }
      }
      if (count > 0) {
        centroids[c] = [sr / count, sg / count, sb / count];
      }
    }
  }

  const counts = new Array(k).fill(0);
  for (let i = 0; i < assignments.length; i++) {
    counts[assignments[i]]++;
  }

  type Cluster = { count: number; r: number; g: number; b: number };
  const clusters: Cluster[] = centroids.map((c, i) => ({
    count: counts[i],
    r: Math.round(c[0]),
    g: Math.round(c[1]),
    b: Math.round(c[2]),
  }));

  clusters.sort((a, b) => b.count - a.count);

  const isBackground = (c: Cluster) => {
    const brightness = (c.r + c.g + c.b) / 3;
    return brightness > 240 || brightness < 15;
  };

  const picked = clusters.find((c) => !isBackground(c)) ?? clusters[0];

  const hex =
    "#" +
    [picked.r, picked.g, picked.b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("");

  return { hex, r: picked.r, g: picked.g, b: picked.b };
}

type Props = {
  onCapture: (color: CapturedColor) => void;
  onClose: () => void;
};

export function ColorCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [frozen, setFrozen] = useState(false);
  const [pickedColor, setPickedColor] = useState<CapturedColor | null>(null);
  const [pickPoint, setPickPoint] = useState<{ x: number; y: number } | null>(
    null
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      setReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
        setError(null);
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const handleFreeze = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    setFrozen(true);
    setPickedColor(null);
    setPickPoint(null);
  }, []);

  const handleCanvasTap = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!frozen) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (clientX - rect.left) * scaleX;
      const py = (clientY - rect.top) * scaleY;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const color = extractColorAtPoint(ctx, px, py, canvas.width, canvas.height);
      setPickedColor(color);
      setPickPoint({
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      });
    },
    [frozen]
  );

  const handleRetake = () => {
    setFrozen(false);
    setPickedColor(null);
    setPickPoint(null);
  };

  const handleAccept = () => {
    if (pickedColor) {
      onCapture(pickedColor);
    }
  };

  return (
    <div className="relative w-full max-w-[500px] mx-auto rounded-xl overflow-hidden bg-black">
      {/* Controls overlay */}
      <div className="absolute top-2 left-2 right-2 flex justify-between z-30">
        <button
          onClick={onClose}
          className="p-2 rounded-full text-white bg-black/50 hover:bg-black/70 transition-colors"
        >
          <X className="size-5" />
        </button>
        {!frozen && (
          <button
            onClick={() =>
              setFacingMode((f) =>
                f === "environment" ? "user" : "environment"
              )
            }
            className="p-2 rounded-full text-white bg-black/50 hover:bg-black/70 transition-colors"
          >
            <SwitchCamera className="size-5" />
          </button>
        )}
      </div>

      {error ? (
        <div className="p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
          {/* Live video (hidden when frozen) */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: frozen ? "none" : "block",
            }}
          />

          {/* Frozen frame canvas (tap to pick) */}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasTap}
            onTouchStart={handleCanvasTap}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: frozen ? "block" : "none",
              cursor: frozen ? "crosshair" : "default",
              touchAction: "none",
            }}
          />

          {/* Tap-point indicator */}
          {frozen && pickPoint && (
            <div
              className="absolute w-9 h-9 rounded-full border-[3px] border-white pointer-events-none z-20"
              style={{
                left: `${pickPoint.x}%`,
                top: `${pickPoint.y}%`,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
              }}
            />
          )}

          {/* Instruction overlay */}
          {frozen && !pickedColor && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg z-20">
              <p className="text-sm text-center">Tap the filament color</p>
            </div>
          )}

          {/* Capture button (live mode) */}
          {!frozen && ready && (
            <>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-white/50 pointer-events-none z-10" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                <button
                  onClick={handleFreeze}
                  className="w-16 h-16 rounded-full bg-white border-4 border-white/50 hover:bg-gray-200 transition-colors flex items-center justify-center"
                >
                  <Camera className="size-7 text-gray-800" />
                </button>
              </div>
            </>
          )}

          {/* Loading spinner before camera ready */}
          {!frozen && !ready && !error && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Loader2 className="size-8 animate-spin text-white" />
            </div>
          )}

          {/* Color result bar */}
          {pickedColor && (
            <div
              className="absolute bottom-0 left-0 right-0 p-4 z-20"
              style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-full border-[3px] border-white shrink-0"
                  style={{ backgroundColor: pickedColor.hex }}
                />
                <div>
                  <p className="text-base font-bold text-white">
                    {pickedColor.hex.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-400">
                    RGB({pickedColor.r}, {pickedColor.g}, {pickedColor.b})
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRetake}
                  className="text-white border-white/50 hover:bg-white/10"
                >
                  <RotateCcw className="size-4 mr-1.5" />
                  Retake
                </Button>
                <Button onClick={handleAccept} className="flex-1">
                  <Check className="size-4 mr-1.5" />
                  Use This Color
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
