import { z } from "zod";
import { nicknameSchema } from "../auth/nickname";

const optionalCoordinate = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().min(minimum).max(maximum).optional(),
  );

export const uuidSchema = z.uuid();

export const condominiumSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(3).max(300),
});

export const workerSchema = z.object({
  nickname: nicknameSchema,
  id: z.uuid().optional(),
  fullName: z.string().trim().min(2).max(120),
  employeeCode: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(128).optional(),
  condominiumIds: z.array(z.uuid()).max(100).default([]),
});

export const checkpointSchema = z
  .object({
    id: z.uuid().optional(),
    condominiumId: z.uuid(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    latitude: optionalCoordinate(-90, 90),
    longitude: optionalCoordinate(-180, 180),
    radiusMeters: z.coerce.number().int().min(10).max(1000).default(75),
  })
  .refine((data) => (data.latitude == null) === (data.longitude == null), {
    message: "Latitud y longitud deben indicarse juntas.",
  });

export const scanRequestSchema = z.object({
  token: z.string().min(40).max(1000),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  accuracyMeters: z.number().min(0).max(100000).nullable(),
}).refine((data) => (data.latitude == null) === (data.longitude == null), {
  message: "Latitud y longitud deben indicarse juntas.",
});

export function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}
