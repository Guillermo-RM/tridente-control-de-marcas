"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { INCIDENT_TYPE_LABELS, incidentTypes } from "@/lib/domain/incidents";

type LocationEvidence = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: number;
};

function requestLocation() {
  return new Promise<LocationEvidence>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no permite obtener la ubicación."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: Date.now(),
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Debes permitir la ubicación en Chrome para enviar la incidencia."
          : "No se pudo obtener una ubicación precisa. Activa el GPS e intenta de nuevo.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  });
}

async function compressEvidence(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo procesar la fotografía.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) throw new Error("No se pudo procesar la fotografía.");
  return new File([blob], "evidencia.jpg", { type: "image/jpeg" });
}

export function IncidentReportForm({ condominiums }: { condominiums: { id: string; name: string }[] }) {
  const [evidence, setEvidence] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [location, setLocation] = useState<LocationEvidence | null>(null);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "warning">("warning");
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const previewRef = useRef("");

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function updateEvidence(file: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = file ? URL.createObjectURL(file) : "";
    previewRef.current = url;
    setEvidence(file);
    setPreview(url);
  }

  async function captureLocation() {
    setIsLocating(true);
    setMessage("Obteniendo ubicación precisa…");
    setTone("warning");
    try {
      const next = await requestLocation();
      setLocation(next);
      setMessage(`Ubicación lista, precisión aproximada de ${Math.round(next.accuracyMeters)} m.`);
      setTone("success");
      return next;
    } catch (error) {
      setLocation(null);
      setMessage(error instanceof Error ? error.message : "No se pudo obtener la ubicación.");
      setTone("error");
      return null;
    } finally {
      setIsLocating(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!evidence) {
      setMessage("Debes tomar o seleccionar una fotografía.");
      setTone("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("Preparando evidencia…");
    setTone("warning");
    try {
      const currentLocation = !location || Date.now() - location.capturedAt > 120_000
        ? await captureLocation()
        : location;
      if (!currentLocation) return;

      const compressed = await compressEvidence(evidence);
      if (compressed.size > 1_572_864) throw new Error("La fotografía continúa siendo demasiado pesada. Toma otra con menor resolución.");
      const formData = new FormData(form);
      formData.set("evidence", compressed);
      formData.set("latitude", String(currentLocation.latitude));
      formData.set("longitude", String(currentLocation.longitude));
      formData.set("accuracyMeters", String(currentLocation.accuracyMeters));

      const response = await fetch("/api/incidents", { method: "POST", body: formData });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "No se pudo enviar la incidencia.");

      form.reset();
      updateEvidence(null);
      setLocation(null);
      setMessage(result?.message ?? "Incidencia enviada correctamente.");
      setTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la incidencia.");
      setTone("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (condominiums.length === 0) {
    return <p className="error-banner">No tienes condominios activos asignados. Comunícate con la administración.</p>;
  }

  return (
    <form className="entity-form incident-form" onSubmit={submit} ref={formRef}>
      <label>
        Condominio
        <select name="condominiumId" required>
          <option value="">Selecciona el lugar del reporte</option>
          {condominiums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>
        Tipo de incidencia
        <select name="incidentType" required>
          <option value="">Selecciona una opción</option>
          {incidentTypes.map((type) => <option key={type} value={type}>{INCIDENT_TYPE_LABELS[type]}</option>)}
        </select>
      </label>
      <label>
        Descripción
        <textarea minLength={10} maxLength={2000} name="description" placeholder="Describe claramente qué ocurrió, dónde y cualquier detalle importante." required rows={6} />
      </label>
      <label>
        Fotografía de evidencia
        <input
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(event) => updateEvidence(event.target.files?.[0] ?? null)}
          required
          type="file"
        />
      </label>
      {preview ? (
        <div className="incident-preview">
          <Image alt="Vista previa de la evidencia" height={320} src={preview} unoptimized width={480} />
        </div>
      ) : null}
      <div className="incident-location-box">
        <strong>Ubicación obligatoria</strong>
        <button className="secondary-button" disabled={isLocating || isSubmitting} onClick={() => void captureLocation()} type="button">
          {isLocating ? "Ubicando…" : location ? "Actualizar ubicación" : "Obtener ubicación"}
        </button>
      </div>
      <button disabled={isSubmitting || isLocating} type="submit">
        {isSubmitting ? "Enviando…" : "Enviar incidencia"}
      </button>
      {message ? <p className={`scan-result ${tone}`} role="status">{message}</p> : null}
    </form>
  );
}
