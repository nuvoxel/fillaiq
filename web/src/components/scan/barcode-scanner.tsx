"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import CloseIcon from "@mui/icons-material/Close";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
import CheckIcon from "@mui/icons-material/Check";
import { BarcodeDetector as BarcodeDetectorPolyfill } from "barcode-detector";

export type DetectedCode = {
  value: string;
  format: string;
};

type Props = {
  /** Called with ALL detected codes when user taps "Done" */
  onDetected: (codes: DetectedCode[]) => void;
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
  const [detectedCodes, setDetectedCodes] = useState<DetectedCode[]>([]);

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

  // Barcode detection loop — accumulates all unique codes
  useEffect(() => {
    if (!scanning) return;

    const DetectorClass =
      (window as any).BarcodeDetector ?? BarcodeDetectorPolyfill;

    const detector = new DetectorClass({
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
    const seenValues = new Set<string>();

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);
        const newCodes: DetectedCode[] = [];

        for (const barcode of barcodes) {
          if (!seenValues.has(barcode.rawValue)) {
            seenValues.add(barcode.rawValue);
            newCodes.push({ value: barcode.rawValue, format: barcode.format });
          }
        }

        if (newCodes.length > 0) {
          setDetectedCodes((prev) => [...prev, ...newCodes]);
          drawHighlights(barcodes);
        }
      } catch {
        // Detection frame error, ignore and retry
      }

      animationId = requestAnimationFrame(detect);
    };

    animationId = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(animationId);
  }, [scanning]);

  const drawHighlights = (barcodes: any[]) => {
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

    for (const barcode of barcodes) {
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
    }
  };

  const handleDone = () => {
    if (detectedCodes.length > 0) {
      onDetected(detectedCodes);
    }
  };

  const handleRemoveCode = (value: string) => {
    setDetectedCodes((prev) => prev.filter((c) => c.value !== value));
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
        <IconButton
          onClick={onClose}
          sx={{ color: "white", bgcolor: "rgba(0,0,0,0.5)" }}
        >
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

      {/* Detected codes list + done button */}
      <Box sx={{ p: 1.5, bgcolor: "rgba(0,0,0,0.85)" }}>
        {detectedCodes.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              py: 0.5,
            }}
          >
            {scanning && <CircularProgress size={14} sx={{ color: "white" }} />}
            <Typography variant="body2" sx={{ color: "grey.400" }}>
              {scanning ? "Scanning for barcodes & QR codes..." : "Starting camera..."}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {detectedCodes.map((code) => (
                <Chip
                  key={code.value}
                  label={`${code.value} (${code.format})`}
                  size="small"
                  onDelete={() => handleRemoveCode(code.value)}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.15)",
                    color: "white",
                    "& .MuiChip-deleteIcon": { color: "grey.400" },
                  }}
                />
              ))}
            </Stack>
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckIcon />}
              onClick={handleDone}
              fullWidth
            >
              Done ({detectedCodes.length} code{detectedCodes.length !== 1 ? "s" : ""})
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
