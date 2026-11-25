import { supabase } from "./supabase";
import type { Fonte } from "./types";

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("cerebro", { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        if (j?.erro) msg = j.erro;
      } catch {
        /* mantém a mensagem padrão */
      }
    }
    throw new Error(msg);
  }
  return data as T;
}

export function processarNota(notaId: string) {
  return chamar<{ reflexao: string; fontes: Fonte[] }>({ acao: "processar", nota_id: notaId });
}

export function conversar(mensagem: string, historico: { role: string; content: string }[]) {
  return chamar<{ resposta: string; fontes: Fonte[] }>({ acao: "conversar", mensagem, historico });
}

export function reprocessarPendentes() {
  return chamar<{ processadas: number }>({ acao: "reprocessar" });
}

export function parseLista(texto: string, removerHash = false): string[] {
  return texto
    .split(/[,;\n]/)
    .map((s) => (removerHash ? s.replace(/^#/, "") : s).trim())
    .filter(Boolean);
}

export function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
