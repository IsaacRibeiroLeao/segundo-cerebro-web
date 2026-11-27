"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { capitulo as buscarCapitulo } from "@/lib/cerebro";
import { useDados } from "@/lib/dados";
import { useLeitura } from "@/lib/leitura";
import { CAPITULOS, NOMES_LIVROS, TOTAL_CAPITULOS, proximoNaoLido, vizinho } from "@/lib/livros";
import type { Versiculos } from "@/lib/types";
import { Pensando } from "@/components/Pensando";
import { CORES_GRIFO, useGrifos, type CorGrifo } from "@/lib/grifos";

const PRIMEIRO_NT = 39;
const POS = "sc_biblia_pos_v1";
const RASCUNHO = "sc_rascunho_v1";

function posicaoInicial(): { livro: number; capitulo: number } {
  try {
    const p = JSON.parse(localStorage.getItem(POS) ?? "null");
    if (p && Number.isInteger(p.livro) && Number.isInteger(p.capitulo) && p.livro >= 0 && p.livro < CAPITULOS.length && p.capitulo >= 1 && p.capitulo <= CAPITULOS[p.livro]) return p;
  } catch { /* posição ilegível: começa do início */ }
  return { livro: 0, capitulo: 1 };
}

export default function Biblia() {
  const router = useRouter();
  const [pos, setPos] = useState<{ livro: number; capitulo: number }>({ livro: 0, capitulo: 1 });
  const [pronto, setPronto] = useState(false);
  const [texto, setTexto] = useState<Versiculos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const { notas } = useDados();
  const { lidos, alternar, erro: erroLeitura } = useLeitura();
  const { grifos, grifar, remover, erro: erroGrifo } = useGrifos(pos.livro, pos.capitulo);
  const [cor, setCor] = useState<CorGrifo>("ouro");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos(posicaoInicial());
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try { localStorage.setItem(POS, JSON.stringify(pos)); } catch { /* sem armazenamento: tudo bem */ }
    let vivo = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTexto(null);
    setErro(null);
    setSelecionados(new Set());
    /* eslint-enable react-hooks/set-state-in-effect */
    buscarCapitulo(pos.livro, pos.capitulo)
      .then((t) => { if (vivo) setTexto(t); })
      .catch((e) => { if (vivo) setErro((e as Error).message); });
    return () => { vivo = false; };
  }, [pos, pronto]);

  const chave = `${pos.livro}:${pos.capitulo}`;
  const lido = lidos?.has(chave) ?? false;
  const anterior = vizinho(pos.livro, pos.capitulo, -1);
  const seguinte = vizinho(pos.livro, pos.capitulo, 1);

  const doCapitulo = useMemo(
    () => (notas ?? []).filter((n) => n.sc_nota_refs.some((r) => r.livro === pos.livro && r.capitulo === pos.capitulo)),
    [notas, pos],
  );

  const porLivro = useMemo(() => {
    const cont = new Array(CAPITULOS.length).fill(0);
    for (const k of lidos ?? []) cont[Number(k.split(":")[0])]++;
    return cont as number[];
  }, [lidos]);
  const totalLidos = porLivro.reduce((s, n) => s + n, 0);
  const proximo = lidos ? proximoNaoLido(lidos) : null;

  function alternarVerso(n: number) {
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(n)) novo.delete(n); else novo.add(n);
      return novo;
    });
  }

  function rotuloSelecao() {
    const nome = `${NOMES_LIVROS[pos.livro]} ${pos.capitulo}`;
    const v = [...selecionados].sort((a, b) => a - b);
    if (!v.length) return nome;
    return v.length === 1 || v[v.length - 1] - v[0] === v.length - 1
      ? `${nome}:${v[0]}${v.length > 1 ? `-${v[v.length - 1]}` : ""}`
      : `${nome}:${v.join(",")}`;
  }

  function anotar() {
    try { localStorage.setItem(RASCUNHO, JSON.stringify({ conteudo: "", refs: rotuloSelecao(), tags: "" })); } catch { /* sem armazenamento */ }
    router.push("/");
  }

  const novo = pos.livro >= PRIMEIRO_NT;
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const ver = texto?.versiculos.filter((v) => !selecionados.size || selecionados.has(v.n)) ?? [];
    const msg = `${ver.map((v) => `${v.n} ${v.texto}`).join(" ")}\n— ${rotuloSelecao()}`;
    try {
      if (navigator.share) await navigator.share({ text: msg });
      else { await navigator.clipboard.writeText(msg); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }
    } catch { /* cancelado */ }
  }

  const select = "rounded-xl border border-line bg-card px-3 py-2 outline-none transition focus:border-accent";
  const sel = [...selecionados];
  const todosGrifados = sel.length > 0 && sel.every((n) => grifos.has(n));

  async function aplicarGrifo() {
    if (todosGrifados) await remover(sel); else await grifar(sel, cor);
    setSelecionados(new Set());
  }

  return (
    <div className="pb-28">
      <h1 className="font-serif text-3xl">Bible</h1>

      <div role="tablist" className="mt-4 inline-flex rounded-2xl border border-line bg-card p-1 text-sm">
        {[["Old Testament", false], ["New Testament", true]].map(([nome, nt]) => (
          <button key={String(nome)} role="tab" aria-selected={novo === nt}
            onClick={() => novo !== nt && setPos({ livro: nt ? PRIMEIRO_NT : 0, capitulo: 1 })}
            className={`press rounded-xl px-3 py-1.5 transition ${novo === nt ? "btn-accent font-medium" : "text-muted"}`}>
            {nome}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select aria-label="Book" value={pos.livro} onChange={(e) => setPos({ livro: Number(e.target.value), capitulo: 1 })} className={select}>
          {NOMES_LIVROS.map((n, i) => (i >= PRIMEIRO_NT) === novo && <option key={n} value={i}>{n}</option>)}
        </select>
        <select aria-label="Chapter" value={pos.capitulo} onChange={(e) => setPos({ ...pos, capitulo: Number(e.target.value) })} className={select}>
          {Array.from({ length: CAPITULOS[pos.livro] }, (_, i) => <option key={i + 1} value={i + 1}>Chapter {i + 1}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button disabled={!anterior} onClick={() => anterior && setPos(anterior)} aria-label="Previous chapter" className="press rounded-xl border border-line px-3 py-2 disabled:opacity-30">←</button>
          <button disabled={!seguinte} onClick={() => seguinte && setPos(seguinte)} aria-label="Next chapter" className="press rounded-xl border border-line px-3 py-2 disabled:opacity-30">→</button>
        </div>
      </div>

      <article className="mx-auto mt-8 max-w-prose">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted">{NOMES_LIVROS[pos.livro]}</p>
        <h2 className="mt-1 text-center font-serif text-5xl text-accent">{pos.capitulo}</h2>
        {!texto && !erro && <p className="mt-6 text-center text-muted"><Pensando texto="Loading" /></p>}
        {erro && <p className="mt-6 rounded-xl bg-accent-soft p-3 text-sm">{erro}</p>}
        {texto && (
          <p key={chave} className="anim-fade-in mt-8 font-serif text-[1.22rem] leading-[2.1rem]">
            {texto.versiculos.map((v) => {
              const g = grifos.get(v.n);
              const on = selecionados.has(v.n);
              return (
                <span key={v.n}>
                  <button
                    onClick={() => alternarVerso(v.n)}
                    aria-pressed={on}
                    style={g && !on ? { backgroundColor: CORES_GRIFO[g] } : undefined}
                    className={`rounded px-0.5 text-left transition-colors [box-decoration-break:clone] ${on ? "bg-accent/25 underline decoration-accent decoration-2 underline-offset-4" : g ? "" : "hover:bg-accent-soft/60"}`}
                  >
                    <sup className="mr-1 text-[0.65rem] font-sans font-semibold text-accent">{v.n}</sup>{v.texto}
                  </button>{" "}
                </span>
              );
            })}
          </p>
        )}
        {texto && !selecionados.size && <p className="mt-6 text-center text-xs text-muted">Tap a verse to highlight, write a note or share.</p>}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => alternar(pos.livro, pos.capitulo)} disabled={!lidos}
            className={`press rounded-xl px-5 py-2.5 text-sm font-medium ${lido ? "border border-accent text-accent" : "btn-accent"}`}>
            {lido ? "✓ Chapter read" : "Mark as read"}
          </button>
          {seguinte && <button onClick={() => setPos(seguinte)} className="press rounded-xl border border-line px-5 py-2.5 text-sm hover:bg-accent-soft">Next chapter →</button>}
        </div>
      </article>

      {selecionados.size > 0 && (
        <div role="toolbar" aria-label="Verse actions" className="anim-fade-up fixed inset-x-3 bottom-[6.25rem] z-20 mx-auto flex max-w-lg flex-wrap items-center justify-center gap-2 rounded-2xl border border-line bg-card px-3 py-3 shadow-xl md:bottom-6">
          <span className="w-full text-center text-xs text-muted">{rotuloSelecao()}</span>
          <div className="flex items-center gap-1.5">
            {(Object.keys(CORES_GRIFO) as CorGrifo[]).map((k) => (
              <button key={k} onClick={() => setCor(k)} aria-label={`Color ${k}`} aria-pressed={cor === k}
                style={{ backgroundColor: CORES_GRIFO[k].replace(/0\.\d+\)/, "0.9)") }}
                className={`press h-7 w-7 rounded-full ring-offset-2 ring-offset-card ${cor === k ? "ring-2 ring-accent" : ""}`} />
            ))}
          </div>
          <button onClick={aplicarGrifo} className="press btn-accent rounded-xl px-3.5 py-2 text-sm font-medium">{todosGrifados ? "Remove highlight" : "Grifar"}</button>
          <button onClick={anotar} className="press rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-accent-soft">Add note</button>
          <button onClick={compartilhar} className="press rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-accent-soft">{copiado ? "Copied ✓" : "Compartilhar"}</button>
          <button onClick={() => setSelecionados(new Set())} aria-label="Clear selection" className="press px-2 text-muted hover:text-ink">✕</button>
        </div>
      )}
      {(erroLeitura || erroGrifo) && <p className="mt-2 text-center text-xs text-muted">Couldn&apos;t save: {erroGrifo ?? erroLeitura}</p>}

      {doCapitulo.length > 0 && (
        <section className="mx-auto mt-10 max-w-prose">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Your notes in this chapter</h3>
          <ul className="mt-2 space-y-2">
            {doCapitulo.map((n) => (
              <li key={n.id}>
                <Link href={`/notas#${n.id}`} className="press lift block rounded-xl border border-line bg-card p-3 text-sm">
                  <span className="line-clamp-2 font-serif">{n.conteudo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto mt-10 max-w-prose rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-serif text-xl">Your progress</h3>
          <span className="text-sm text-muted">{totalLidos} of {TOTAL_CAPITULOS} chapters</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-accent-soft" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_CAPITULOS} aria-valuenow={totalLidos}>
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(totalLidos / TOTAL_CAPITULOS) * 100}%` }} />
        </div>
        {proximo && (
          <button onClick={() => setPos(proximo)} className="press mt-3 text-sm text-accent">
            Continue in {NOMES_LIVROS[proximo.livro]} {proximo.capitulo} →
          </button>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted">Go to a book</summary>
          <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {NOMES_LIVROS.map((n, i) => (
              <li key={n}>
                <button onClick={() => setPos({ livro: i, capitulo: 1 })} className="press block w-full text-left">
                  <span className="flex justify-between gap-2">
                    <span>{n}</span>
                    <span className="text-muted">
                      {porLivro[i] >= CAPITULOS[i] ? <span className="text-accent">✓ complete</span> : porLivro[i] > 0 ? `${porLivro[i]} read` : ""}
                    </span>
                  </span>
                  {porLivro[i] > 0 && (
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-accent-soft">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${(porLivro[i] / CAPITULOS[i]) * 100}%` }} />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
