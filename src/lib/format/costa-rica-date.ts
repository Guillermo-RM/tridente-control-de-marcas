const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sept", "oct", "nov", "dic",
] as const;

/**
 * Formato estable para las marcas. Costa Rica usa UTC-6 todo el año, por lo que
 * evitamos depender de las diferencias de Intl/ICU entre Node.js y el navegador.
 */
export function formatCostaRicaDateTime(value: string | Date) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return "Fecha no disponible";

  const local = new Date(instant.getTime() - 6 * 60 * 60 * 1_000);
  const hours = local.getUTCHours();
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "p. m." : "a. m.";
  const hour12 = hours % 12 || 12;

  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}, ${hour12}:${minutes} ${period}`;
}

export function costaRicaCsvDateTime(value: string | Date) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return { date: "", time: "" };

  const local = new Date(instant.getTime() - 6 * 60 * 60 * 1_000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  const hours = String(local.getUTCHours()).padStart(2, "0");
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  const seconds = String(local.getUTCSeconds()).padStart(2, "0");

  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}:${seconds}` };
}
