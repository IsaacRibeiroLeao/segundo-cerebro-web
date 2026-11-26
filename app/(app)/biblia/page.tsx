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

  const select = "rounded-xl border border-line bg-card px-3 py-2 outline-none transition focus:border-accent";

  return (
    <div>
      <h1 className="font-serif text-3xl">Bíblia</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select aria-label="Livro" value={pos.livro} onChange={(e) => setPos({ livro: Number(e.target.value), capitulo: 1 })} className={select}>
          {NOMES_LIVROS.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
        <select aria-label="Capítulo" value={pos.capitulo} onChange={(e) => setPos({ ...pos, capitulo: Number(e.target.value) })} className={select}>
          {Array.from({ length: CAPITULOS[pos.livro] }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button disabled={!anterior} onClick={() => anterior && setPos(anterior)} aria-label="Capítulo anterior" className="press rounded-xl border border-line px-3 py-2 disabled:opacity-30">←</button>
          <button disabled={!seguinte} onClick={() => seguinte && setPos(seguinte)} aria-label="Próximo capítulo" className="press rounded-xl border border-line px-3 py-2 disabled:opacity-30">→</button>
        </div>
      </div>

      <article className="mt-6">
        <h2 className="font-serif text-2xl">{NOMES_LIVROS[pos.livro]} {pos.capitulo}</h2>
        {!texto && !erro && <p className="mt-4 text-muted"><Pensando texto="Carregando" /></p>}
        {erro && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm">{erro}</p>}
        {texto && (
          <div key={chave} className="anim-fade-in mt-4 space-y-1 font-serif text-lg leading-relaxed">
            {texto.versiculos.map((v) => (
              <p key={v.n}>
                <button
                  onClick={() => alternarVerso(v.n)}
                  aria-pressed={selecionados.has(v.n)}
                  className={`rounded px-1 text-left transition-colors ${selecionados.has(v.n) ? "bg-accent-soft" : "hover:bg-accent-soft/50"}`}
                >
                  <sup className="mr-1 text-xs text-accent">{v.n}</sup>{v.texto}
                </button>
              </p>
            ))}
          </div>
        )}
      </article>

      <div className="glass sticky bottom-24 mt-6 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 md:bottom-4">
        <button onClick={() => alternar(pos.livro, pos.capitulo)} disabled={!lidos}
          className={`press rounded-xl px-4 py-2 text-sm font-medium ${lido ? "border border-accent text-accent" : "btn-accent"}`}>
          {lido ? "✓ Lido" : "Marcar como lido"}
        </button>
        <button onClick={anotar} disabled={!texto} className="press rounded-xl border border-line px-4 py-2 text-sm hover:bg-accent-soft disabled:opacity-40">
          Anotar sobre {selecionados.size ? rotuloSelecao() : "este capítulo"}
        </button>
        {lido && seguinte && (
          <button onClick={() => setPos(seguinte)} className="press ml-auto text-sm text-accent">Próximo →</button>
        )}
      </div>
      {erroLeitura && <p className="mt-2 text-xs text-muted">Não consegui salvar a leitura: {erroLeitura}</p>}

      {doCapitulo.length > 0 && (
        <section className="mt-8">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Suas notas neste capítulo</h3>
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

      <section className="mt-10 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-serif text-xl">Seu progresso</h3>
          <span className="text-sm text-muted">{totalLidos} de {TOTAL_CAPITULOS} capítulos</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-accent-soft" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_CAPITULOS} aria-valuenow={totalLidos}>
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(totalLidos / TOTAL_CAPITULOS) * 100}%` }} />
        </div>
        {proximo && (
          <button onClick={() => setPos(proximo)} className="press mt-3 text-sm text-accent">
            Continuar em {NOMES_LIVROS[proximo.livro]} {proximo.capitulo} →
          </button>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted">Por livro</summary>
          <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {NOMES_LIVROS.map((n, i) => (
              <li key={n}>
                <button onClick={() => setPos({ livro: i, capitulo: 1 })} className="press block w-full text-left">
                  <span className="flex justify-between"><span>{n}</span><span className="text-muted">{porLivro[i]}/{CAPITULOS[i]}</span></span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-accent-soft">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(porLivro[i] / CAPITULOS[i]) * 100}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
