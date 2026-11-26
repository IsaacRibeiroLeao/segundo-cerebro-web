import { describe, expect, it } from "vitest";
import { extrairRefs, rotulo } from "../supabase/functions/cerebro/biblia";

describe("extrairRefs", () => {
  it("lê referência completa em texto corrido", () => {
    const [r] = extrairRefs("Hoje li João 3:16 e fiquei pensando.", false);
    expect(r.rotulo).toBe("João 3:16");
    expect(r).toMatchObject({ capitulo: 3, v_ini: 16, v_fim: null });
  });
  it("lê intervalo de versículos", () => {
    expect(extrairRefs("Salmos 23:1-4", false)[0].rotulo).toBe("Salmos 23:1-4");
  });
  it("aceita abreviação no campo digitado (lenient)", () => {
    expect(extrairRefs("Sl 23", true)[0].rotulo).toBe("Salmos 23");
    expect(extrairRefs("1Co 13:4", true)[0].rotulo).toBe("1 Coríntios 13:4");
  });
  it("em texto corrido ignora abreviação curta sem versículo", () => {
    expect(extrairRefs("Isso aconteceu na 3 vezes", false)).toEqual([]);
    expect(extrairRefs("os 2 filhos", false)).toEqual([]);
  });
  it("rejeita capítulo que não existe", () => {
    expect(extrairRefs("Salmos 999:1", false)).toEqual([]);
  });
  it("reconhece Jó com acento", () => {
    expect(extrairRefs("Jó 1:21", true)[0].rotulo).toBe("Jó 1:21");
  });
  it("não repete a mesma referência", () => {
    expect(extrairRefs("João 3:16 e de novo João 3:16", false)).toHaveLength(1);
  });
});

describe("rotulo", () => {
  it("monta o texto da referência", () => {
    expect(rotulo(42, 3, 16, null)).toBe("João 3:16");
    expect(rotulo(18, 23, 1, 1)).toBe("Salmos 23:1");
    expect(rotulo(44, 8, null, null)).toBe("Romanos 8");
  });
});
