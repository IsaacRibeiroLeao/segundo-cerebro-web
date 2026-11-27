"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { gerarRevisao } from "@/lib/cerebro";
import type { Fonte, Revisao } from "@/lib/types";
import { TextoComCitacoes } from "./Citacoes";
import { limparCitacoes } from "@/lib/texto";
import { Pensando } from "./Pensando";

const SETE_DIAS = 7 * 86400000;

export function RevisaoCard() {
  const [agora] = useState(() => Date.now());
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    supabase
      .from("sc_revisoes")
      .select("id, inicio, fim, texto, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setRevisao((data?.[0] as Revisao | undefined) ?? null);
        setPronto(true);
      });
  }, []);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const r = await gerarRevisao(7);
      setRevisao({ id: r.revisao.id ?? "nova", inicio: r.revisao.inicio, fim: r.revisao.fim, texto: r.revisao.texto, created_at: r.revisao.created_at ?? new Date().toISOString() });
      setFontes(r.fontes);
    } catch (e) {
      setErro((e as Error).message);
    }
    setGerando(false);
  }

  if (!pronto) return null;
  const recente = revisao && agora - new Date(revisao.created_at).getTime() < SETE_DIAS;

  return (
    <section className="anim-fade-up mt-8 rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "120ms" }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl">Weekly review</h2>
        {revisao && (
          <button onClick={gerar} disabled={gerando} className="press text-sm text-muted hover:text-ink disabled:opacity-50">
            Generate again
          </button>
        )}
      </div>
      {gerando ? (
        <p className="mt-3"><Pensando texto="Rereading your week" /></p>
      ) : recente && revisao ? (
        <div className="anim-fade-in mt-3">
          {fontes.length ? <TextoComCitacoes texto={revisao.texto} fontes={fontes} /> : <p className="whitespace-pre-wrap leading-relaxed">{limparCitacoes(revisao.texto)}</p>}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted">A summary of what the Lord has been saying to you over the last 7 days, with themes, passages and a question for next week.</p>
          <button onClick={gerar} className="press btn-accent mt-4 rounded-xl px-4 py-2 text-sm font-medium text-paper">
            Generate review
          </button>
        </div>
      )}
      {erro && <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm">{erro}</p>}
    </section>
  );
}
