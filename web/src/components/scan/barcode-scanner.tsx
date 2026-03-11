"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import CloseIcon from "@mui/icons-material/Close";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";

type Props = {
  onDetected: (value: string, format: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
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
        setScanning(true);
        setError(null);
      }
    } catch (e) {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  // Barcode detection loop
  useEffect(() => {
    if (!scanning) return;

    // Check for BarcodeDetector API
    const BarcodeDetector = (window as any).BarcodeDetector;
    if (!BarcodeDetector) {
      setError(
        "BarcodeDetector API not supported in this browser. Try Chrome on Android or Safari on iOS."
      );
      return;
    }

    const detector = new BarcodeDetector({
      formats: [
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "code_128",
        "code_39",
        "qr_code",
        "data_matrix",
      ],
    });

    let animationId: number;
    let lastDetected = "";

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const barcode = barcodes[0];
          // Debounce: don't fire twice for same barcode
          if (barcode.rawValue !== lastDetected) {
            lastDetected = barcode.rawValue;
            // Draw highlight on canvas
            drawHighlight(barcode);
            onDetected(barcode.rawValue, barcode.format);
          }
        }
      } catch {
        // Detection frame error, ignore and retry
      }

      animationId = requestAnimationFrame(detect);
    };

    animationId = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(animationId);
  }, [scanning, onDetected]);

  const drawHighlight = (barcode: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#FF5C2E";
    ctx.lineWidth = 4;

    const points = barcode.cornerPoints;
    if (points?.length === 4) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
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
          zIndex: 2,
        }}
      >
        <IconButton onClick={onClose} sx={{ color: "white", bgcolor: "rgba(0,0,0,0.5)" }}>
          <CloseIcon />
        </IconButton>
        <IconButton
          onClick={() =>
            setFacingMode((f) => (f === "environment" ? "user" : "environment"))
          }
          sx={{ color: "white", bgcolor: "rgba(0,0,0,0.5)" }}
        >
          <FlipCameraIosIcon />
        </IconButton>
      </Box>

      {/* Scanning indicator */}
      {scanning && (
        <Box
          sx={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
          }}
        >
          <Chip
            icon={<CircularProgress size={14} sx={{ color: "white" }} />}
            label="Scanning for barcodes..."
            sx={{ bgcolor: "rgba(0,0,0,0.6)", color: "white" }}
          />
        </Box>
      )}

      {error ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
