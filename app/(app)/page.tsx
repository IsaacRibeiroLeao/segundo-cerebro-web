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

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function Hoje() {
  const { notas, recarregar } = useDados();
  const [conteudo, setConteudo] = useState("");
  const [refs, setRefs] = useState("");
  const [tags, setTags] = useState("");
  const [fase, setFase] = useState<"livre" | "guardando" | "conectando">("livre");
  const [erro, setErro] = useState<string | null>(null);
  const [pendenteId, setPendenteId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<(ResultadoProcesso & { notaId: string }) | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const tentou = useRef(false);

  const ditado = useDitado((t) => setConteudo((c) => (c ? `${c} ${t}` : t)));

  // Notas antigas sem análise: processa em segundo plano, poucas por vez.
  const pendentes = notas?.filter((n) => !n.processada_em && n.id !== pendenteId).length ?? 0;
  useEffect(() => {
    if (!pendentes || tentou.current) return;
    tentou.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnalisando(true);
    reprocessarPendentes()
      .catch(() => undefined)
      .finally(async () => {
        await recarregar();
        setAnalisando(false);
      });
  }, [pendentes, recarregar]);

  async function conectar(notaId: string) {
    setFase("conectando");
    try {
      const r = await processarNota(notaId);
      setResultado({ ...r, notaId });
      setPendenteId(null);
    } catch (e) {
      setPendenteId(notaId);
      setErro(`Nota guardada, mas a análise falhou: ${(e as Error).message}`);
    }
    await recarregar();
    setFase("livre");
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
      setErro(error?.message ?? "Não foi possível salvar.");
      setFase("livre");
      return;
    }
    setConteudo("");
    setRefs("");
    setTags("");
    await conectar(data.id);
  }

  const notaResultado = resultado ? notas?.find((n) => n.id === resultado.notaId) : undefined;
  const recentes = notas?.slice(0, 4) ?? [];
  const { perfil } = usePerfil();
  const nomeUsuario = perfil?.nome?.split(" ")[0];

  return (
    <div>
      <p className="anim-fade-up text-sm text-muted">
        {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="anim-fade-up mt-1 font-serif text-3xl md:text-4xl" style={{ animationDelay: "40ms" }}>
        {saudacao()}{nomeUsuario ? `, ${nomeUsuario}` : ""}.
      </h1>
      <p className="anim-fade-up mt-2 text-muted" style={{ animationDelay: "80ms" }}>
        O que você leu ou sentiu hoje?
      </p>

      <form
        onSubmit={salvar}
        className="anim-fade-up mt-6 rounded-2xl border border-line bg-card p-4 transition-shadow focus-within:shadow-[0_0_0_3px_var(--accent-soft)] md:p-5"
        style={{ animationDelay: "120ms" }}
      >
        <div className="relative">
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Escreva aqui o que o Espírito Santo falou ao seu coração…"
            rows={5}
            className="w-full resize-y bg-transparent pr-10 font-serif text-lg leading-relaxed outline-none placeholder:text-muted/70"
          />
          {ditado.suportado && (
            <button
              type="button"
              onClick={ditado.alternar}
              aria-pressed={ditado.ativo}
              aria-label={ditado.ativo ? "Parar de ouvir" : "Ditar por voz"}
              title={ditado.ativo ? "Parar" : "Ditar por voz"}
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
            onChange={(e) => setRefs(e.target.value)}
            placeholder="Passagem (opcional): João 15:5, Sl 23"
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (opcional): fé, obediência"
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Sem passagem? Eu sugiro uma para dar contexto.</p>
          <button
            disabled={fase !== "livre" || !conteudo.trim()}
            className="press btn-accent rounded-xl px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
          >
            {fase === "guardando" ? "Guardando…" : fase === "conectando" ? "Conectando…" : "Guardar e conectar"}
          </button>
        </div>
      </form>

      {fase === "conectando" && (
        <p className="anim-fade-in mt-5 text-sm"><Pensando texto="Procurando ligações com o que você já escreveu" /></p>
      )}
      {analisando && fase === "livre" && (
        <p className="anim-fade-in mt-5 text-sm"><Pensando texto="Analisando suas notas antigas" /></p>
      )}
      {erro && (
        <div className="anim-fade-up mt-4 rounded-xl bg-accent-soft p-3 text-sm text-ink">
          {erro}
          {pendenteId && (
            <button onClick={() => { setErro(null); conectar(pendenteId); }} className="press ml-3 font-medium text-accent underline-offset-4 hover:underline">
              Tentar de novo
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
            <p className="text-xs font-medium uppercase tracking-wide text-accent">Nota guardada e conectada</p>
          </div>

          {resultado.passagem && (
            <div>
              <p className="mb-1.5 text-xs text-muted">Para dar contexto à sua nota:</p>
              <Passagem rotulo={resultado.passagem.ref} sugerida motivo={resultado.passagem.motivo} />
            </div>
          )}

          <div>
            <TextoComCitacoes texto={resultado.reflexao} fontes={resultado.fontes} />
            <ListaFontes fontes={resultado.fontes.filter((f) => f.motivo)} />
          </div>

          {notaResultado && <TagsSugeridas nota={notaResultado} aoMudar={recarregar} />}

          <Link href="/conversar" className="press inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">
            Quero pensar mais sobre isso →
          </Link>
        </section>
      )}

      <RevisaoCard />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl">Últimas anotações</h2>
          <Link href="/notas" className="text-sm text-muted hover:text-ink">Ver todas</Link>
        </div>
        {notas && recentes.length === 0 ? (
          <div className="mt-4 flex flex-col items-center text-center">
            <Image src="/icons/ilustracao-vazio.png" alt="" width={220} height={220} className="anim-fade-up" />
            <p className="mt-2 text-muted">Sua primeira anotação começa aqui.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentes.map((n, i) => {
              const p = passagemPrincipal(n);
              return (
                <li key={n.id} className="anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link href={`/notas#${n.id}`} className="lift block rounded-2xl border border-line bg-card p-4 hover:border-accent/50">
                    <p className="text-xs text-muted">
                      {formatarData(n.created_at)}
                      {p ? ` · ${p.rotulo}${p.sugerida ? " (sugerida)" : ""}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-3 font-serif">{n.conteudo}</p>
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
