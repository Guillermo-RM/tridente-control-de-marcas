const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) =>
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
  "image/webp": (bytes) =>
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
};

export const INCIDENT_IMAGE_MAX_BYTES = 1_572_864;

export async function isAllowedIncidentImage(file: File) {
  const matchesSignature = SIGNATURES[file.type];
  if (!matchesSignature || file.size < 1 || file.size > INCIDENT_IMAGE_MAX_BYTES) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return matchesSignature(bytes);
}
