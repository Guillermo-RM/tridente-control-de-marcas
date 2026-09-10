import { presentLocation } from "@/lib/geo/location-presentation";

export function ScanLocation({
  status,
  latitude,
  longitude,
  compact = false,
}: {
  status: string;
  latitude: number | null;
  longitude: number | null;
  compact?: boolean;
}) {
  const location = presentLocation(status, latitude, longitude);

  return (
    <div className={`scan-location ${compact ? "compact" : ""}`}>
      <span className={`location-chip ${location.tone}`}>{location.label}</span>
      {location.mapUrl ? (
        <a
          aria-label="Ver ubicación de la marca en Google Maps"
          className="map-link"
          href={location.mapUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Ver mapa
        </a>
      ) : null}
    </div>
  );
}
