"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckIcon from "@mui/icons-material/Check";

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
  // Sample a region around the tap point (~8% of the shorter dimension)
  const radius = Math.floor(Math.min(canvasWidth, canvasHeight) * 0.08);
  const x0 = Math.max(0, Math.floor(px - radius));
  const y0 = Math.max(0, Math.floor(py - radius));
  const w = Math.min(radius * 2, canvasWidth - x0);
  const h = Math.min(radius * 2, canvasHeight - y0);

  const imageData = ctx.getImageData(x0, y0, w, h);
  const { data } = imageData;

  // Collect pixels within circle
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

  // K-means with k=3
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

  // Pick largest non-background cluster
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

  // Freeze frame: draw video to canvas and pause
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

  // Tap on frozen frame to pick color
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

      // Map from display coords to canvas pixel coords
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (clientX - rect.left) * scaleX;
      const py = (clientY - rect.top) * scaleY;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const color = extractColorAtPoint(ctx, px, py, canvas.width, canvas.height);
      setPickedColor(color);
      // Store pick point in display-relative percentages for the indicator
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
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 500,
        mx: "auto",
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "black",
      }}
    >
      {/* Controls overlay */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          left: 8,
          right: 8,
          display: "flex",
          justifyContent: "space-between",
          zIndex: 3,
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{ color: "white", bgcolor: "rgba(0,0,0,0.5)" }}
        >
          <CloseIcon />
        </IconButton>
        {!frozen && (
          <IconButton
            onClick={() =>
              setFacingMode((f) =>
                f === "environment" ? "user" : "environment"
              )
            }
            sx={{ color: "white", bgcolor: "rgba(0,0,0,0.5)" }}
          >
            <FlipCameraIosIcon />
          </IconButton>
        )}
      </Box>

      {error ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
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
            <Box
              sx={{
                position: "absolute",
                left: `${pickPoint.x}%`,
                top: `${pickPoint.y}%`,
                transform: "translate(-50%, -50%)",
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "3px solid white",
                boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
          )}

          {/* Instruction overlay */}
          {frozen && !pickedColor && (
            <Box
              sx={{
                position: "absolute",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                bgcolor: "rgba(0,0,0,0.7)",
                color: "white",
                px: 2,
                py: 1,
                borderRadius: 2,
                zIndex: 2,
              }}
            >
              <Typography variant="body2" textAlign="center">
                Tap the filament color
              </Typography>
            </Box>
          )}

          {/* Capture button (live mode) */}
          {!frozen && ready && (
            <>
              {/* Center crosshair hint */}
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.5)",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  bottom: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 2,
                }}
              >
                <IconButton
                  onClick={handleFreeze}
                  sx={{
                    bgcolor: "white",
                    width: 64,
                    height: 64,
                    border: "4px solid rgba(255,255,255,0.5)",
                    "&:hover": { bgcolor: "grey.200" },
                  }}
                >
                  <CameraAltIcon sx={{ fontSize: 28, color: "grey.800" }} />
                </IconButton>
              </Box>
            </>
          )}

          {/* Loading spinner before camera ready */}
          {!frozen && !ready && !error && (
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <CircularProgress sx={{ color: "white" }} />
            </Box>
          )}

          {/* Color result bar */}
          {pickedColor && (
            <Box
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                p: 2,
                background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
                zIndex: 2,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  mb: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    bgcolor: pickedColor.hex,
                    border: "3px solid white",
                    flexShrink: 0,
                  }}
                />
                <Box>
                  <Typography
                    variant="body1"
                    fontWeight={700}
                    sx={{ color: "white" }}
                  >
                    {pickedColor.hex.toUpperCase()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "grey.400" }}>
                    RGB({pickedColor.r}, {pickedColor.g}, {pickedColor.b})
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<ReplayIcon />}
                  onClick={handleRetake}
                  sx={{
                    color: "white",
                    borderColor: "rgba(255,255,255,0.5)",
                  }}
                >
                  Retake
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CheckIcon />}
                  onClick={handleAccept}
                  sx={{ flex: 1 }}
                >
                  Use This Color
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
