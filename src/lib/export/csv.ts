export function csvCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";

  let text = String(value).replace(/[\r\n]+/g, " ");
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

export function safeCsvFileSegment(value: string) {
  const segment = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return segment || "condominio";
}
