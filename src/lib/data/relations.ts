export function relationName(value: unknown, fallback = "—") {
  const item = Array.isArray(value) ? value[0] : value;
  if (
    item &&
    typeof item === "object" &&
    "name" in item &&
    typeof item.name === "string"
  ) {
    return item.name;
  }
  return fallback;
}
