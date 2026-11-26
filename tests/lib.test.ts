import { describe, expect, it } from "vitest";
import { parseLista, formatarData } from "../lib/cerebro";
import { calcularLayout, corDoTema } from "../lib/grafo";
import { exportarMarkdown } from "../lib/dados";
import { limparCitacoes } from "../lib/texto";
import type { Nota } from "../lib/types";

describe("parseLista", () => {
  it("separa por vírgula e limpa espaços", () => expect(parseLista(" fé ,  obediência ")).toEqual(["fé", "obediência"]));
  it("remove # das tags", () => expect(parseLista("#fé, #paz", true)).toEqual(["fé", "paz"]));
  it("ignora vazios", () => expect(parseLista(",, ,")).toEqual([]));
});

describe("limparCitacoes", () => {
  it("tira marcações [n]", () => expect(limparCitacoes("Veja [1] e também [12].")).toBe("Veja e também."));
});

describe("calcularLayout", () => {
  it("devolve uma posição por nota, dentro da área", () => {
    const pos = calcularLayout(5, [{ a: 0, b: 1, s: 1 }, { a: 1, b: 2, s: 0.5 }], 900, 620);
    expect(pos).toHaveLength(5);
    for (const p of pos) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(900);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(620);
    }
  });
  it("funciona sem notas", () => expect(calcularLayout(0, [], 900, 620)).toEqual([]));
});

describe("corDoTema", () => {
  it("é estável para o mesmo tema", () => expect(corDoTema("fé")).toBe(corDoTema("fé")));
  it("aceita nulo", () => expect(typeof corDoTema(null)).toBe("string"));
});

describe("exportarMarkdown", () => {
  const nota = (over: Partial<Nota>): Nota => ({
    id: "1", conteudo: "Texto", referencias: [], tags: ["fé"], tags_sugeridas: [], reflexao: null, reflexao_fontes: null,
    passagem_ia: null, processada_em: null, created_at: "2026-01-02T12:00:00Z", sc_nota_refs: [], ...over,
  });
  it("ordena por data e inclui tags e passagens", () => {
    const md = exportarMarkdown([
      nota({ id: "b", conteudo: "Segunda", created_at: "2026-02-01T12:00:00Z", sc_nota_refs: [{ rotulo: "João 3:16", origem: "ia", livro: 42, capitulo: 3 }] }),
      nota({ id: "a", conteudo: "Primeira" }),
    ]);
    expect(md.indexOf("Primeira")).toBeLessThan(md.indexOf("Segunda"));
    expect(md).toContain("João 3:16 (sugerida)");
    expect(md).toContain("#fé");
  });
  it("cita a reflexão", () => expect(exportarMarkdown([nota({ reflexao: "Linha 1\nLinha 2" })])).toContain("> Reflexão: Linha 1\n> Linha 2"));
});

describe("formatarData", () => {
  it("devolve texto", () => expect(typeof formatarData("2026-01-02T12:00:00Z")).toBe("string"));
});
