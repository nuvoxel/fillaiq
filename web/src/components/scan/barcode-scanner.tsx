"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { X, SwitchCamera, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
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

  // Barcode detection loop
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
    ctx.strokeStyle = "#00D2FF";
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
    <div className="relative w-full max-w-[500px] mx-auto rounded-xl overflow-hidden bg-black">
      {/* Controls overlay */}
      <div className="absolute top-2 left-2 right-2 flex justify-between z-10">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <X className="size-5" />
        </button>
        <button
          onClick={() =>
            setFacingMode((f) => (f === "environment" ? "user" : "environment"))
          }
          className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <SwitchCamera className="size-5" />
        </button>
      </div>

      {error ? (
        <div className="p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <div className="relative w-full aspect-[4/3]">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        </div>
      )}

      {/* Detected codes list + done button */}
      <div className="p-3 bg-black/85">
        {detectedCodes.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-1">
            {scanning && <Loader2 className="size-3.5 animate-spin text-white" />}
            <span className="text-sm text-gray-400">
              {scanning ? "Scanning for barcodes & QR codes..." : "Starting camera..."}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">
              {detectedCodes.map((code) => (
                <Badge
                  key={code.value}
                  variant="secondary"
                  className="bg-white/15 text-white cursor-pointer"
                  onClick={() => handleRemoveCode(code.value)}
                >
                  {code.value} ({code.format})
                </Badge>
              ))}
            </div>
            <Button size="sm" onClick={handleDone} className="w-full">
              <Check className="size-4 mr-1" />
              Done ({detectedCodes.length} code{detectedCodes.length !== 1 ? "s" : ""})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
