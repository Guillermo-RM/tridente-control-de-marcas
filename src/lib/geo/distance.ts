const EARTH_RADIUS_METERS = 6_371_000;

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function classifyLocation(
  checkpoint: { latitude: number | null; longitude: number | null; radius_meters: number },
  reading: { latitude: number | null; longitude: number | null; accuracyMeters: number | null },
) {
  if (
    checkpoint.latitude == null || checkpoint.longitude == null ||
    reading.latitude == null || reading.longitude == null
  ) {
    return { status: "unavailable" as const, distance: null };
  }

  const distance = distanceMeters(
    { latitude: checkpoint.latitude, longitude: checkpoint.longitude },
    { latitude: reading.latitude, longitude: reading.longitude },
  );
  const tolerance = Math.min(reading.accuracyMeters ?? 0, 100);
  return {
    status: distance <= checkpoint.radius_meters + tolerance
      ? ("verified" as const)
      : ("outside" as const),
    distance: Math.round(distance * 100) / 100,
  };
}
