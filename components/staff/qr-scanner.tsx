"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
  onScan: (value: string) => void;
  disabled?: boolean;
};

export function QrScanner({ onScan, disabled }: Props) {
  const videoId = useId().replace(/:/g, "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastScanRef = useRef<string>("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (disabled) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraSupported(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setCameraSupported(true);

        type BarcodeDetectorApi = new (options: { formats: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
        };
        const BarcodeDetectorCtor = (
          window as Window & { BarcodeDetector?: BarcodeDetectorApi }
        ).BarcodeDetector;

        if (BarcodeDetectorCtor) {
          const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });

          intervalId = setInterval(async () => {
            if (!videoRef.current || cancelled) return;
            try {
              const codes = await detector.detect(videoRef.current);
              const value = codes[0]?.rawValue;
              if (value && value !== lastScanRef.current) {
                lastScanRef.current = value;
                onScan(value);
              }
            } catch {
              /* frame not ready */
            }
          }, 400);
        } else {
          setCameraError("QR detection not supported in this browser — use manual entry.");
        }
      } catch {
        setCameraSupported(false);
        setCameraError("Camera permission denied or unavailable.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stopCamera();
    };
  }, [disabled, onScan, stopCamera]);

  return (
    <div className="space-y-2">
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-lg border bg-black">
        <video
          id={videoId}
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {cameraSupported === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80 p-4 text-center text-sm text-white">
            Camera unavailable — paste QR payload below.
          </div>
        )}
      </div>
      {cameraError && <p className="text-sm text-amber-700">{cameraError}</p>}
    </div>
  );
}
