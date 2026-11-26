"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { evolucao, formatarData, gerarRevisao } from "@/lib/cerebro";
import { useDados } from "@/lib/dados";
import { NOMES_LIVROS, passagemPrincipal, type Fonte, type Revisao } from "@/lib/types";
import { TextoComCitacoes } from "@/components/Citacoes";
import { Pensando } from "@/components/Pensando";
import { limparCitacoes } from "@/lib/texto";

type Filtro = { tipo: "tag" | "livro"; valor: string | number } | null;

function mesAno(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function LinhaDoTempo() {
  const { notas } = useDados();
  const [aba, setAba] = useState<"notas" | "revisoes">("notas");
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [evo, setEvo] = useState<{ texto: string; tema: string; fontes: Fonte[] } | null>(null);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revisoes, setRevisoes] = useState<Revisao[] | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (aba !== "revisoes") return;
    supabase.from("sc_revisoes").select("id, inicio, fim, texto, created_at").order("created_at", { ascending: false }).then(({ data }) => setRevisoes((data ?? []) as Revisao[]));
  }, [aba]);

  const { tags, livros } = useMemo(() => {
    const t = new Map<string, number>();
    const l = new Map<number, number>();
    for (const n of notas ?? []) {
      for (const x of n.tags) t.set(x, (t.get(x) ?? 0) + 1);
      for (const r of new Set(n.sc_nota_refs.map((r) => r.livro))) l.set(r, (l.get(r) ?? 0) + 1);
    }
    return {
      tags: [...t.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([x]) => x),
      livros: [...l.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x]) => x),
    };
  }, [notas]);

  const lista = useMemo(() => {
    const base = [...(notas ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (!filtro) return base;
    return base.filter((n) => (filtro.tipo === "tag" ? n.tags.includes(filtro.valor as string) : n.sc_nota_refs.some((r) => r.livro === filtro.valor)));
  }, [notas, filtro]);

  const grupos = useMemo(() => {
    const m = new Map<string, typeof lista>();
    for (const n of lista) {
      const k = mesAno(n.created_at);
      m.set(k, [...(m.get(k) ?? []), n]);
    }
    return [...m.entries()];
  }, [lista]);

  function escolher(f: Filtro) {
    setFiltro(f);
    setEvo(null);
    setErro(null);
  }

  async function contarEvolucao() {
    if (!filtro) return;
    setPensando(true);
    setErro(null);
    try {
      setEvo(await evolucao(filtro.tipo === "tag" ? { tag: filtro.valor as string } : { livro: filtro.valor as number }));
    } catch (e) {
      setErro((e as Error).message);
    }
    setPensando(false);
  }

  async function novaRevisao() {
    setGerando(true);
    setErro(null);
    try {
      const r = await gerarRevisao(7);
      setRevisoes((atual) => [{ id: r.revisao.id ?? crypto.randomUUID(), inicio: r.revisao.inicio, fim: r.revisao.fim, texto: r.revisao.texto, created_at: r.revisao.created_at ?? new Date().toISOString() }, ...(atual ?? [])]);
    } catch (e) {
      setErro((e as Error).message);
    }
    setGerando(false);
  }

  const chip = (ativo: boolean) => `press rounded-full border px-3 py-1 text-sm ${ativo ? "border-accent bg-accent text-paper" : "border-line text-muted hover:text-ink"}`;

  return (
    <div>
      <h1 className="font-serif text-3xl">Linha do tempo</h1>
      <p className="mt-1 text-muted">Veja como cada tema foi crescendo ao longo dos meses.</p>

      <div className="mt-5 inline-flex rounded-xl border border-line bg-card p-1 text-sm">
        {(["notas", "revisoes"] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`press rounded-lg px-4 py-1.5 transition-colors ${aba === a ? "bg-accent text-paper" : "text-muted hover:text-ink"}`}>
            {a === "notas" ? "Notas" : "Revisões"}
          </button>
        ))}
      </div>

      {erro && <p className="anim-fade-up mt-4 rounded-xl bg-accent-soft p-3 text-sm">{erro}</p>}

      {aba === "notas" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => escolher(null)} className={chip(!filtro)}>Tudo</button>
            {tags.map((t) => <button key={t} onClick={() => escolher({ tipo: "tag", valor: t })} className={chip(filtro?.tipo === "tag" && filtro.valor === t)}>#{t}</button>)}
            {livros.map((l) => <button key={l} onClick={() => escolher({ tipo: "livro", valor: l })} className={chip(filtro?.tipo === "livro" && filtro.valor === l)}>{NOMES_LIVROS[l]}</button>)}
          </div>

          {filtro && lista.length >= 2 && (
            <div className="anim-fade-up mt-4 rounded-2xl border border-accent/40 bg-accent-soft p-4">
              {pensando ? <Pensando texto="Lendo o caminho deste tema" /> : evo ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-accent">Como {evo.tema} evoluiu</p>
                  <div className="mt-2"><TextoComCitacoes texto={evo.texto} fontes={evo.fontes} /></div>
                </>
              ) : (
                <button onClick={contarEvolucao} className="press text-sm font-medium text-accent hover:underline">Como esse tema evoluiu? →</button>
              )}
            </div>
          )}

          {!notas && <p className="mt-8"><Pensando texto="Carregando" /></p>}
          {notas && lista.length === 0 && <p className="mt-8 text-center text-muted">Nenhuma nota nesse recorte.</p>}

          <div className="relative mt-8 ml-3 border-l border-line pl-6">
            {grupos.map(([mes, itens], gi) => (
              <section key={mes} className="mb-8">
                <h2 className="anim-fade-up -ml-[34px] mb-4 flex items-center gap-3 font-serif text-lg first-letter:uppercase" style={{ animationDelay: `${gi * 60}ms` }}>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-accent bg-paper" aria-hidden="true" />
                  {mes}
                </h2>
                <ul className="space-y-3">
                  {itens.map((n, i) => {
                    const p = passagemPrincipal(n);
                    return (
                      <li key={n.id} className="anim-fade-up relative" style={{ animationDelay: `${gi * 60 + i * 40}ms` }}>
                        <span className="absolute -left-[29px] top-5 h-2 w-2 rounded-full bg-accent/60" aria-hidden="true" />
                        <Link href={`/notas#${n.id}`} className="lift block rounded-2xl border border-line bg-card p-4 hover:border-accent/50">
                          <p className="text-xs text-muted">{formatarData(n.created_at)}{p ? ` · ${p.sugerida ? "✦ " : ""}${p.rotulo}` : ""}</p>
                          <p className="mt-1 line-clamp-3 font-serif">{n.conteudo}</p>
                          {n.tags.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">{n.tags.map((t) => <span key={t}>#{t}</span>)}</p>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5">
          <button onClick={novaRevisao} disabled={gerando} className="press btn-accent rounded-xl px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
            {gerando ? "Gerando…" : "Gerar revisão dos últimos 7 dias"}
          </button>
          {gerando && <p className="mt-3"><Pensando texto="Relendo a sua semana" /></p>}
          {revisoes && revisoes.length === 0 && !gerando && <p className="mt-6 text-center text-muted">Nenhuma revisão ainda.</p>}
          <ul className="mt-5 space-y-3">
            {(revisoes ?? []).map((r, i) => (
              <li key={r.id} className="anim-fade-up rounded-2xl border border-line bg-card p-5" style={{ animationDelay: `${i * 50}ms` }}>
                <p className="text-xs text-muted">{formatarData(r.inicio)} a {formatarData(r.fim)}</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{limparCitacoes(r.texto)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
