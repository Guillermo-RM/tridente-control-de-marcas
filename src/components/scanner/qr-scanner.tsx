"use client";

import type { IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

import { extractScanToken } from "@/lib/security/scan-token";

type ResultState = {
  kind: "success" | "warning" | "error";
  message: string;
  checkpointName?: string;
} | null;

function getPosition() {
  return new Promise<GeolocationPosition | null>((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      maximumAge: 15_000,
      timeout: 12_000,
    });
  });
}

export function QrScanner({ initialToken }: { initialToken?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const submittingRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultState>(null);

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function submitToken(rawValue: string) {
    if (submittingRef.current) return;
    const token = extractScanToken(rawValue);
    if (!token) {
      setResult({ kind: "error", message: "El código leído no pertenece a Tridente Control." });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setResult(null);
    controlsRef.current?.stop();
    setCameraActive(false);
    const position = await getPosition();

    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          latitude: position?.coords.latitude ?? null,
          longitude: position?.coords.longitude ?? null,
          accuracyMeters: position?.coords.accuracy ?? null,
        }),
      });
      const data = await response.json();
      setResult({
        kind: response.ok ? (data.locationStatus === "verified" ? "success" : "warning") : "error",
        message: data.message ?? "No se pudo procesar la marca.",
        checkpointName: data.checkpointName,
      });
    } catch {
      setResult({ kind: "error", message: "Sin conexión. La marca no fue enviada; vuelve a intentarlo." });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function startCamera() {
    setResult(null);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current ?? undefined,
        (decoded) => {
          if (decoded) void submitToken(decoded.getText());
        },
      );
      controlsRef.current = controls;
      setCameraActive(true);
    } catch {
      setResult({ kind: "error", message: "No fue posible abrir la cámara. Revisa sus permisos y usa HTTPS." });
    }
  }

  return (
    <section className="scanner-card">
      <div className="video-frame">
        <video muted playsInline ref={videoRef} />
        {!cameraActive ? <span>La cámara está detenida</span> : null}
      </div>
      <div className="scanner-actions">
        {initialToken ? (
          <button disabled={submitting} onClick={() => void submitToken(initialToken)} type="button">
            {submitting ? "Guardando…" : "Registrar esta marca"}
          </button>
        ) : null}
        <button className="secondary-button" disabled={submitting || cameraActive} onClick={() => void startCamera()} type="button">
          {cameraActive ? "Apunta al código QR" : "Abrir cámara"}
        </button>
      </div>
      {result ? (
        <div aria-live="polite" className={`scan-result ${result.kind}`} role="status">
          {result.checkpointName ? <strong>{result.checkpointName}</strong> : null}
          <span>{result.message}</span>
          {result.kind === "warning" ? <small>La marca quedó guardada con una alerta de ubicación.</small> : null}
        </div>
      ) : null}
    </section>
  );
}
