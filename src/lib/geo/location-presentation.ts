export type LocationStatus = "verified" | "outside" | "unavailable";

function validCoordinate(value: number | null) {
  return value !== null && Number.isFinite(Number(value));
}

export function presentLocation(
  status: string,
  latitude: number | null,
  longitude: number | null,
) {
  const hasCoordinates = validCoordinate(latitude) && validCoordinate(longitude);

  if (status === "verified") {
    return { label: "Ubicación verificada", tone: "verified", mapUrl: hasCoordinates ? googleMapsUrl(latitude!, longitude!) : null };
  }
  if (status === "outside") {
    return { label: "Fuera de zona", tone: "outside", mapUrl: hasCoordinates ? googleMapsUrl(latitude!, longitude!) : null };
  }
  if (hasCoordinates) {
    return { label: "Ubicación registrada", tone: "captured", mapUrl: googleMapsUrl(latitude!, longitude!) };
  }
  return { label: "Sin ubicación", tone: "unavailable", mapUrl: null };
}

function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;
}
