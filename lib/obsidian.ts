import type { Conexao, Nota } from "./types";

function semAcento(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function titulo(n: Nota) {
  const primeira = n.conteudo.split("\n").find((l) => l.trim()) ?? "Nota";
  const limpo = semAcento(primeira)
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50)
    .trim();
  return limpo || "Nota";
}

// Uma nota por arquivo, com propriedades YAML, tags e [[links]] para as notas conectadas.
export function montarCofre(notas: Nota[], conexoes: Conexao[]): { nome: string; conteudo: string }[] {
  const nomes = new Map<string, string>();
  const usados = new Set<string>();
  for (const n of [...notas].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const base = `${n.created_at.slice(0, 10)} ${titulo(n)}`;
    let nome = base;
    if (usados.has(nome.toLowerCase())) nome = `${base} (${n.id.slice(0, 4)})`;
    usados.add(nome.toLowerCase());
    nomes.set(n.id, nome);
  }

  return notas.map((n) => {
    const ligacoes = conexoes
      .filter((c) => c.a === n.id || c.b === n.id)
      .map((c) => ({ alvo: nomes.get(c.a === n.id ? c.b : c.a), motivo: c.motivo }))
      .filter((l): l is { alvo: string; motivo: string } => !!l.alvo);
    const refs = n.sc_nota_refs.map((r) => (r.origem === "ia" ? `${r.rotulo} (suggested)` : r.rotulo));
    const yaml = [
      "---",
      `created: ${n.created_at.slice(0, 10)}`,
      refs.length ? `passagens: [${refs.map((r) => JSON.stringify(r)).join(", ")}]` : null,
      n.tags.length ? `tags: [${n.tags.map((t) => JSON.stringify(t)).join(", ")}]` : null,
      "---",
    ].filter(Boolean).join("\n");
    const corpo = [
      n.conteudo,
      n.reflexao ? `> [!note] Reflection\n> ${n.reflexao.replace(/\n/g, "\n> ")}` : "",
      ligacoes.length ? `## Conexões\n${ligacoes.map((l) => `- [[${l.alvo}]] — ${l.motivo}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
    return { nome: `${nomes.get(n.id)}.md`, conteudo: `${yaml}\n\n${corpo}\n` };
  });
}
