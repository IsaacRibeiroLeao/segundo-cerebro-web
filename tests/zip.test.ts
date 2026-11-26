import { describe, expect, it } from "vitest";
import { crc32, criarZip } from "../lib/zip";
import { montarCofre } from "../lib/obsidian";
import { proximoNaoLido, vizinho } from "../lib/livros";
import type { Conexao, Nota } from "../lib/types";

describe("zip", () => {
  it("crc32 conhecido", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("assinaturas e contagem de arquivos", () => {
    const z = criarZip([{ nome: "a.md", conteudo: "olá" }, { nome: "b.md", conteudo: "x" }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
  });
});

describe("livros", () => {
  it("vizinho atravessa livros", () => {
    expect(vizinho(0, 50, 1)).toEqual({ livro: 1, capitulo: 1 });
    expect(vizinho(1, 1, -1)).toEqual({ livro: 0, capitulo: 50 });
    expect(vizinho(0, 1, -1)).toBeNull();
    expect(vizinho(65, 22, 1)).toBeNull();
  });
  it("próximo não lido", () => {
    expect(proximoNaoLido(new Set(["0:1", "0:2"]))).toEqual({ livro: 0, capitulo: 3 });
  });
});

const nota = (id: string, conteudo: string, dia: string): Nota => ({
  id, conteudo, referencias: [], tags: ["fe"], tags_sugeridas: [], reflexao: null, reflexao_fontes: null,
  passagem_ia: null, processada_em: null, created_at: `${dia}T10:00:00Z`, sc_nota_refs: [{ rotulo: "João 3:16", origem: "usuario", livro: 42, capitulo: 3 }],
});

describe("obsidian", () => {
  it("gera links entre notas conectadas e nomes únicos", () => {
    const notas = [nota("a1", "Amor de Deus", "2026-01-01"), nota("b2", "Amor de Deus", "2026-01-01")];
    const con: Conexao[] = [{ id: "c", a: "a1", b: "b2", tipo: "tag", peso: 1, motivo: "Mesma tag: #fe" }];
    const cofre = montarCofre(notas, con);
    expect(new Set(cofre.map((c) => c.nome)).size).toBe(2);
    expect(cofre[0].conteudo).toContain("[[2026-01-01 Amor de Deus (b2");
    expect(cofre[0].conteudo).toContain('tags: ["fe"]');
  });
});
