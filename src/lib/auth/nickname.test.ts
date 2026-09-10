import { describe, expect, it } from "vitest";
import { nicknameSchema } from "./nickname";

describe("nickname de acceso", () => {
  it("normaliza mayúsculas y espacios exteriores para compartir identidad y límite de intentos", () => {
    expect(nicknameSchema.parse("  Juan.Perez_01 ")).toBe("juan.perez_01");
  });
  it.each(["ab", "a".repeat(33), "juan perez", "josé", "juan@example.com", ".juan", "admin%' OR true"])(
    "rechaza un identificador inválido: %s",
    (nickname) => expect(nicknameSchema.safeParse(nickname).success).toBe(false),
  );
});
