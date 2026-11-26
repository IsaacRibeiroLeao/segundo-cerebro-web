import { supabase } from "./supabase";
import type { Fonte, Versiculos } from "./types";

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

export type ResultadoProcesso = {
  reflexao: string;
  tagsSugeridas: string[];
  passagem: { ref: string; motivo: string } | null;
  fontes: Fonte[];
};

export const processarNota = (notaId: string, origem: "auto" | "edicao" | "manual" = "auto") =>
  chamar<ResultadoProcesso>({ acao: "processar", nota_id: notaId, origem });

export const reconectar = (notaId: string) => chamar<{ conexoes: number }>({ acao: "reconectar", nota_id: notaId });

export const buscar = (consulta: string) =>
  chamar<{ semantica: boolean; resultados: { id: string; score: number }[] }>({ acao: "buscar", consulta });

export const conversar = (mensagem: string, historico: { role: string; content: string }[]) =>
  chamar<{ resposta: string; fontes: Fonte[] }>({ acao: "conversar", mensagem, historico });

const cacheVersiculos = new Map<string, Versiculos>();
export async function versiculo(ref: string): Promise<Versiculos> {
  const hit = cacheVersiculos.get(ref);
  if (hit) return hit;
  const v = await chamar<Versiculos>({ acao: "versiculo", ref });
  cacheVersiculos.set(ref, v);
  return v;
}

const cacheCapitulos = new Map<string, Versiculos>();
export async function capitulo(livro: number, cap: number): Promise<Versiculos> {
  const chave = `${livro}:${cap}`;
  const hit = cacheCapitulos.get(chave);
  if (hit) return hit;
  const v = await chamar<Versiculos>({ acao: "capitulo", livro, capitulo: cap });
  cacheCapitulos.set(chave, v);
  return v;
}

export const gerarRevisao = (dias = 7) =>
  chamar<{ revisao: { id?: string; inicio: string; fim: string; texto: string; created_at?: string }; fontes: Fonte[] }>({
    acao: "revisao",
    dias,
  });

export const evolucao = (filtro: { tag?: string; livro?: number }) =>
  chamar<{ texto: string; tema: string; fontes: Fonte[] }>({ acao: "evolucao", ...filtro });

export const reprocessarPendentes = () =>
  chamar<{ processadas: number; restantes: number }>({ acao: "reprocessar", lote: 3 });

export function parseLista(texto: string, removerHash = false): string[] {
  return texto
    .split(/[,;\n]/)
    .map((s) => (removerHash ? s.trim().replace(/^#+/, "") : s).trim())
    .filter(Boolean);
}

export function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
