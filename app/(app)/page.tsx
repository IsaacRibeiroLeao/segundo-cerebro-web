"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatarData, parseLista, processarNota, reprocessarPendentes, type ResultadoProcesso } from "@/lib/cerebro";
import { useDados } from "@/lib/dados";
import { passagemPrincipal } from "@/lib/types";
import { ListaFontes, TextoComCitacoes } from "@/components/Citacoes";
import { Icon } from "@/components/Icon";
import { Passagem } from "@/components/Passagem";
import { Pensando } from "@/components/Pensando";
import { RevisaoCard } from "@/components/RevisaoCard";
import { TagsSugeridas } from "@/components/TagsSugeridas";
import { usePerfil } from "@/lib/perfil";
import { useDitado } from "@/components/useDitado";
import { Tile } from "@/components/Tile";
import { useLeitura } from "@/lib/leitura";
import { NOMES_LIVROS, TOTAL_CAPITULOS, proximoNaoLido } from "@/lib/livros";

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const RASCUNHO = "sc_rascunho_v1";

function estatisticas(datas: string[]) {
  const agora = new Date().getTime();
  return { semana: datas.filter((d) => agora - new Date(d).getTime() < 7 * 864e5).length, sequencia: diasSeguidos(datas) };
}

// Dias seguidos (até hoje ou ontem) com ao menos uma nota.
function diasSeguidos(datas: string[]) {
  const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const set = new Set(datas.map((d) => dia(new Date(d))));
  const c = new Date();
  if (!set.has(dia(c))) c.setDate(c.getDate() - 1);
  let n = 0;
  while (set.has(dia(c))) { n++; c.setDate(c.getDate() - 1); }
  return n;
}

export default function Hoje() {
  const { notas, recarregar } = useDados();
  const [conteudo, setConteudo] = useState("");
  const [refs, setRefs] = useState("");
  const [tags, setTags] = useState("");
  const [fase, setFase] = useState<"livre" | "guardando">("livre");
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendenteId, setPendenteId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<(ResultadoProcesso & { notaId: string }) | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const tentou = useRef(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const { lidos } = useLeitura();
  const rascunhoPronto = useRef(false);

  // Rascunho: o que está sendo escrito sobrevive a trocar de aba ou recarregar.
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(RASCUNHO) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (r) { setConteudo(r.conteudo ?? ""); setRefs(r.refs ?? ""); setTags(r.tags ?? ""); }
    } catch { /* rascunho ilegível: ignora */ }
    rascunhoPronto.current = true;
  }, []);
  useEffect(() => {
    if (!rascunhoPronto.current) return;
    const t = setTimeout(() => {
      try {
        if (conteudo || refs || tags) localStorage.setItem(RASCUNHO, JSON.stringify({ conteudo, refs, tags }));
        else localStorage.removeItem(RASCUNHO);
      } catch { /* sem armazenamento: tudo bem */ }
    }, 400);
    return () => clearTimeout(t);
  }, [conteudo, refs, tags]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("novo")) campo.current?.focus();
  }, []);

  const ditado = useDitado((t) => setConteudo((c) => (c ? `${c} ${t}` : t)));

  // Notas antigas sem análise: processa em segundo plano, poucas por vez.
  const pendentes = notas?.filter((n) => !n.processada_em && n.id !== pendenteId).length ?? 0;
  useEffect(() => {
    if (!pendentes || tentou.current) return;
    tentou.current = true;
    setAnalisando(true);
    reprocessarPendentes()
      .catch(() => undefined)
      .finally(async () => {
        await recarregar();
        setAnalisando(false);
      });
  }, [pendentes, recarregar]);

  async function conectar(notaId: string) {
    setConectando(true);
    setResultado(null);
    try {
      const r = await processarNota(notaId);
      setResultado({ ...r, notaId });
      setPendenteId(null);
    } catch (e) {
      setPendenteId(notaId);
      setErro(`Note saved, but the analysis failed: ${(e as Error).message}`);
    }
    await recarregar();
    setConectando(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!conteudo.trim() || fase !== "livre") return;
    setErro(null);
    setResultado(null);
    setFase("guardando");
    const { data, error } = await supabase
      .from("sc_notas")
      .insert({ conteudo: conteudo.trim(), referencias: parseLista(refs), tags: parseLista(tags, true) })
      .select("id")
      .single();
    if (error || !data) {
      setErro(error?.message ?? "Couldn't save.");
      setFase("livre");
      return;
    }
    setConteudo("");
    setRefs("");
    setTags("");
    try { localStorage.removeItem(RASCUNHO); } catch { /* sem armazenamento: tudo bem */ }
    await recarregar();
    // Libera o formulário já: a análise chega em seguida, sem prender a pessoa.
    setFase("livre");
    void conectar(data.id);
  }

  const notaResultado = resultado ? notas?.find((n) => n.id === resultado.notaId) : undefined;
  const recentes = notas?.slice(0, 4) ?? [];
  const { perfil } = usePerfil();
  const nomeUsuario = perfil?.nome?.split(" ")[0];
  const { semana, sequencia } = estatisticas(notas?.map((n) => n.created_at) ?? []);
  const lidosN = lidos?.size ?? 0;
  const proximo = lidos ? proximoNaoLido(lidos) : null;

  return (
    <div>
      <p className="anim-fade-up text-sm text-muted">
        {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="anim-fade-up mt-1 font-serif text-3xl md:text-4xl" style={{ animationDelay: "40ms" }}>
        {saudacao()}{nomeUsuario ? `, ${nomeUsuario}` : ""}.
      </h1>
      <p className="anim-fade-up mt-2 text-muted" style={{ animationDelay: "80ms" }}>
        What did you read or feel today?
      </p>

      {lidos && notas && (
        <section className="cartao-ouro anim-fade-up mt-6 rounded-2xl p-5" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-serif text-lg">Your journey continues</p>
              <p className="mt-0.5 text-sm text-muted">
                {lidosN} of {TOTAL_CAPITULOS} chapters · {semana} {semana === 1 ? "note" : "notes"} this week · {sequencia}-day streak
              </p>
            </div>
            <Tile nome="biblia" tamanho={42} ativo />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={lidosN} aria-valuemin={0} aria-valuemax={TOTAL_CAPITULOS} aria-label="Chapters read">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(1, (lidosN / TOTAL_CAPITULOS) * 100)}%` }} />
          </div>
          {proximo && (
            <Link href="/biblia" className="press mt-3 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">
              Continue in {NOMES_LIVROS[proximo.livro]} {proximo.capitulo} →
            </Link>
          )}
        </section>
      )}

      <form
        onSubmit={salvar}
        className="anim-fade-up mt-5 rounded-2xl border border-line bg-card p-4 transition-shadow focus-within:shadow-[0_0_0_3px_var(--accent-soft)] md:p-5"
        style={{ animationDelay: "120ms" }}
      >
        <div className="relative">
          <textarea
            ref={campo}
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            aria-label="Your note"
            placeholder="Write here what the Holy Spirit spoke to your heart…"
            rows={5}
            className="w-full resize-y bg-transparent pr-10 font-serif text-lg leading-relaxed outline-none placeholder:text-muted/70"
          />
          {ditado.suportado && (
            <button
              type="button"
              onClick={ditado.alternar}
              aria-pressed={ditado.ativo}
              aria-label={ditado.ativo ? "Stop listening" : "Dictate by voice"}
              title={ditado.ativo ? "Parar" : "Dictate by voice"}
              className={`press absolute right-0 top-0 grid h-9 w-9 place-items-center rounded-full ${ditado.ativo ? "bg-accent text-paper" : "text-muted hover:text-ink"}`}
            >
              {ditado.ativo && <span className="anim-breathe absolute inset-0 rounded-full bg-accent" aria-hidden="true" />}
              <span className="relative"><Icon nome="microfone" className="h-5 w-5" /></span>
            </button>
          )}
        </div>
        {ditado.erro && <p className="text-xs text-muted">{ditado.erro}</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={refs}
            aria-label="Bible passage (optional)"
            onChange={(e) => setRefs(e.target.value)}
            placeholder="Passage (optional): João 15:5, Sl 23"
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
          <input
            value={tags}
            aria-label="Tags (optional)"
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (optional): faith, obedience"
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">No passage? I&apos;ll suggest one for context. <span className="hidden md:inline">Ctrl+Enter saves.</span></p>
          <button
            disabled={fase !== "livre" || !conteudo.trim()}
            className="press btn-accent rounded-xl px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
          >
            {fase === "guardando" ? "Saving…" : "Save and connect"}
          </button>
        </div>
      </form>

      {conectando && (
        <p className="anim-fade-in mt-5 text-sm"><Pensando texto="Looking for links to what you've already written" /></p>
      )}
      {analisando && !conectando && (
        <p className="anim-fade-in mt-5 text-sm"><Pensando texto="Analyzing your older notes" /></p>
      )}
      {erro && (
        <div className="anim-fade-up mt-4 rounded-xl bg-accent-soft p-3 text-sm text-ink">
          {erro}
          {pendenteId && (
            <button onClick={() => { setErro(null); conectar(pendenteId); }} className="press ml-3 font-medium text-accent underline-offset-4 hover:underline">
              Try again
            </button>
          )}
        </div>
      )}

      {resultado && (
        <section className="anim-fade-up mt-6 space-y-4 rounded-2xl border border-accent/40 bg-accent-soft p-5">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="anim-check" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            <p className="text-xs font-medium uppercase tracking-wide text-accent">Note saved and connected</p>
          </div>

          {resultado.passagem && (
            <div>
              <p className="mb-1.5 text-xs text-muted">To give your note context:</p>
              <Passagem rotulo={resultado.passagem.ref} sugerida motivo={resultado.passagem.motivo} />
            </div>
          )}

          <div>
            <TextoComCitacoes texto={resultado.reflexao} fontes={resultado.fontes} />
            <ListaFontes fontes={resultado.fontes.filter((f) => f.motivo)} />
          </div>

          {notaResultado && <TagsSugeridas nota={notaResultado} aoMudar={recarregar} />}

          <Link href="/conversar" className="press inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">
            I want to think more about this →
          </Link>
        </section>
      )}

      <RevisaoCard />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl">Latest notes</h2>
          <Link href="/notas" className="text-sm text-muted hover:text-ink">See all</Link>
        </div>
        {notas && recentes.length === 0 ? (
          <div className="mt-4 flex flex-col items-center text-center">
            <Image src="/icons/ilustracao-vazio.png" alt="" width={220} height={220} className="anim-fade-up" />
            <p className="mt-2 text-muted">Your first note starts here.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentes.map((n, i) => {
              const p = passagemPrincipal(n);
              return (
                <li key={n.id} className="anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link href={`/notas#${n.id}`} className="lift flex items-start gap-3 rounded-2xl border border-line bg-card p-4 hover:border-accent/50">
                    <Tile nome="notas" tamanho={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted">
                        {formatarData(n.created_at)}
                        {p ? ` · ${p.rotulo}${p.sugerida ? " (suggested)" : ""}` : ""}
                      </span>
                      <span className="mt-1 line-clamp-3 block font-serif">{n.conteudo}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
