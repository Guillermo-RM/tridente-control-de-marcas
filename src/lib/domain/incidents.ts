export const incidentTypes = [
  "suspicious_person",
  "suspicious_vehicle",
  "open_access",
  "damage",
  "lighting",
  "emergency",
  "other",
] as const;

export const incidentStatuses = ["pending", "in_progress", "resolved"] as const;
export const INCIDENT_NOTIFICATIONS_CHANGED = "incident-notifications-changed";

export type IncidentType = (typeof incidentTypes)[number];
export type IncidentStatus = (typeof incidentStatuses)[number];

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  suspicious_person: "Persona sospechosa",
  suspicious_vehicle: "Vehículo sospechoso",
  open_access: "Acceso abierto",
  damage: "Daño",
  lighting: "Iluminación",
  emergency: "Emergencia",
  other: "Otro",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  resolved: "Resuelta",
};
