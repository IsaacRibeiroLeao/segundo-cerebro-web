"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { COLUNAS_NOTA, type Conexao, type Nota } from "./types";

// Cache de módulo: navegar entre telas mostra o que já foi baixado na hora e atualiza em segundo plano.
let cache: { notas: Nota[]; conexoes: Conexao[] } | null = null;
export function limparCacheDados() { cache = null; }

export function useDados() {
  const [notas, setNotas] = useState<Nota[] | null>(cache?.notas ?? null);
  const [conexoes, setConexoes] = useState<Conexao[]>(cache?.conexoes ?? []);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const [n, c] = await Promise.all([
      supabase.from("sc_notas").select(COLUNAS_NOTA).order("created_at", { ascending: false }),
      supabase.from("sc_conexoes").select("id, a, b, tipo, peso, motivo"),
    ]);
    if (n.error) {
      setErro(n.error.message);
      return;
    }
    setErro(null);
    cache = { notas: (n.data ?? []) as unknown as Nota[], conexoes: (c.data ?? []) as Conexao[] };
    setNotas(cache.notas);
    setConexoes(cache.conexoes);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar();
  }, [recarregar]);

  return { notas, conexoes, erro, recarregar };
}

export function baixar(nome: string, conteudo: string | Uint8Array<ArrayBuffer>, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarMarkdown(notas: Nota[]) {
  return [...notas]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((n) => {
      const data = new Date(n.created_at).toLocaleDateString("pt-BR");
      const refs = n.sc_nota_refs.map((r) => (r.origem === "ia" ? `${r.rotulo} (sugerida)` : r.rotulo)).join(", ");
      const tags = n.tags.map((t) => `#${t}`).join(" ");
      return [
        `## ${data}${refs ? ` — ${refs}` : ""}`,
        tags,
        "",
        n.conteudo,
        n.reflexao ? `\n> Reflexão: ${n.reflexao.replace(/\n/g, "\n> ")}` : "",
      ]
        .filter((l) => l !== "")
        .join("\n");
    })
    .join("\n\n---\n\n");
}
