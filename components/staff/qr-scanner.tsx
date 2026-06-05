"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  onScan: (value: string) => void;
  disabled?: boolean;
};

function mapCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return "Camera permission denied. Allow camera access or use manual entry below.";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "No camera found on this device. Use manual entry below.";
    }
    if (err.name === "NotReadableError") {
      return "Camera is in use by another app. Close it and try again.";
    }
    if (err.name === "SecurityError") {
      return "Camera requires a secure (HTTPS) connection.";
    }
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("permission") || message.includes("not allowed")) {
      return "Camera permission denied. Allow camera access or use manual entry below.";
    }
    if (message.includes("not found") || message.includes("no camera")) {
      return "No camera found on this device. Use manual entry below.";
    }
  }

  return "Camera unavailable. Use manual entry below.";
}

export function QrScanner({ onScan, disabled }: Props) {
  const readerId = useId().replace(/:/g, "");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const lastScanRef = useRef("");
  const onScanRef = useRef(onScan);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    disabledRef.current = disabled;
    if (!disabled) {
      lastScanRef.current = "";
    }
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;

    let cancelled = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera not supported in this browser. Use manual entry below.");
        setCameraReady(false);
        return;
      }

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        scanner = new Html5Qrcode(readerId, {
          verbose: false,
          useBarCodeDetectorIfSupported: false,
        });

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            aspectRatio: 1,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.floor(edge * 0.7);
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            if (cancelled || disabledRef.current) return;
            const value = decodedText.trim();
            if (!value || value === lastScanRef.current) return;
            lastScanRef.current = value;
            onScanRef.current(value);
          },
          () => {
            /* expected when no QR in frame */
          },
        );

        if (!cancelled) {
          setCameraReady(true);
          setCameraError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setCameraReady(false);
          setCameraError(mapCameraError(err));
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      setCameraReady(false);

      if (!scanner) return;

      const instance = scanner;
      const stopPromise = instance.isScanning ? instance.stop() : Promise.resolve();
      stopPromise
        .then(() => instance.clear())
        .catch(() => {});
    };
  }, [readerId, disabled]);

  return (
    <div className="space-y-2">
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-lg border bg-black">
        <div
          id={readerId}
          className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        {!cameraReady && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-900/80 p-4 text-center text-sm text-white">
            {cameraError ?? "Starting camera…"}
          </div>
        )}
      </div>
    </div>
  );
}
