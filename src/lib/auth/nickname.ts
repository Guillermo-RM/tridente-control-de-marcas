import { z } from "zod";

export const nicknameSchema = z.string().trim().toLowerCase()
  .min(3, "El nickname debe tener entre 3 y 32 caracteres.")
  .max(32, "El nickname debe tener entre 3 y 32 caracteres.")
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "Usa letras sin tildes, números, puntos, guiones o guiones bajos.");
