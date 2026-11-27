"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatarData } from "@/lib/cerebro";
import { useDados } from "@/lib/dados";
import { calcularLayout, corDoTema } from "@/lib/grafo";
import { GRUPO, NOMES_LIVROS, passagemPrincipal, type Conexao, type GrupoConexao, type Nota } from "@/lib/types";
import { ROTULO_GRUPO } from "@/components/Conexoes";
import { Passagem } from "@/components/Passagem";
import { Pensando } from "@/components/Pensando";

const L = 900;
const A = 620;

type No = {
  nota: Nota;
  x: number;
  y: number;
  r: number;
  cor: string;
  grau: number;
  etiqueta: string;
  tema: string | null;
};
type Aresta = { chave: string; a: string; b: string; conexoes: Conexao[]; peso: number; grupo: GrupoConexao };

const ESTILO_GRUPO: Record<GrupoConexao, { cor: string; dash?: string }> = {
  sentido: { cor: "var(--accent)" },
  passagem: { cor: "var(--sage)", dash: "7 5" },
  tema: { cor: "var(--muted)", dash: "2 5" },
};
const PRIORIDADE: GrupoConexao[] = ["passagem", "sentido", "tema"];

const PERIODOS = [
  { id: "30", nome: "30 days", dias: 30 },
  { id: "90", nome: "90 days", dias: 90 },
  { id: "365", nome: "1 year", dias: 365 },
  { id: "tudo", nome: "Tudo", dias: 0 },
];

function etiqueta(n: Nota) {
  const p = passagemPrincipal(n);
  if (p) return p.rotulo;
  const palavras = n.conteudo.replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
  return palavras.length > 22 ? `${palavras.slice(0, 21)}…` : palavras;
}

export default function Mapa() {
  const { notas, conexoes, erro } = useDados();
  const [periodo, setPeriodo] = useState("tudo");
  const [tag, setTag] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<Record<GrupoConexao, boolean>>({ sentido: true, passagem: true, tema: true });
  const [soConectadas, setSoConectadas] = useState(false);
  const [sel, setSel] = useState<{ tipo: "no" | "aresta"; id: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const todasTags = useMemo(() => {
    const f = new Map<string, number>();
    for (const n of notas ?? []) for (const t of n.tags) f.set(t, (f.get(t) ?? 0) + 1);
    return [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  }, [notas]);

  const [agora] = useState(() => Date.now());
  const { nos, arestas, temas } = useMemo(() => {
    const dias = PERIODOS.find((p) => p.id === periodo)?.dias ?? 0;
    const corte = dias ? agora - dias * 86400000 : 0;
    let base = (notas ?? []).filter((n) => new Date(n.created_at).getTime() >= corte);
    if (tag) base = base.filter((n) => n.tags.includes(tag));
    const ids = new Set(base.map((n) => n.id));

    // Uma aresta por par, guardando todos os motivos.
    const porPar = new Map<string, Aresta>();
    for (const c of conexoes) {
      if (!grupos[GRUPO[c.tipo]] || !ids.has(c.a) || !ids.has(c.b)) continue;
      const chave = `${c.a}|${c.b}`;
      const atual = porPar.get(chave) ?? { chave, a: c.a, b: c.b, conexoes: [], peso: 0, grupo: GRUPO[c.tipo] };
      atual.conexoes.push(c);
      atual.peso = Math.max(atual.peso, c.peso);
      if (PRIORIDADE.indexOf(GRUPO[c.tipo]) < PRIORIDADE.indexOf(atual.grupo)) atual.grupo = GRUPO[c.tipo];
      porPar.set(chave, atual);
    }
    const arestasTodas = [...porPar.values()];
    const grau = new Map<string, number>();
    for (const e of arestasTodas) {
      grau.set(e.a, (grau.get(e.a) ?? 0) + 1);
      grau.set(e.b, (grau.get(e.b) ?? 0) + 1);
    }
    if (soConectadas) base = base.filter((n) => grau.get(n.id));
    const idx = new Map(base.map((n, i) => [n.id, i]));
    const arestasVisiveis = arestasTodas.filter((e) => idx.has(e.a) && idx.has(e.b));
    const pos = calcularLayout(base.length, arestasVisiveis.map((e) => ({ a: idx.get(e.a)!, b: idx.get(e.b)!, s: e.peso })), L, A);

    const nosCalc: No[] = base.map((n, i) => {
      const p = passagemPrincipal(n);
      const livro = n.sc_nota_refs[0] ? NOMES_LIVROS[n.sc_nota_refs[0].livro] : null;
      const tema = n.tags[0] ?? livro;
      const g = grau.get(n.id) ?? 0;
      return { nota: n, x: pos[i].x, y: pos[i].y, r: Math.min(26, 11 + 3.2 * Math.sqrt(g)), cor: corDoTema(tema), grau: g, etiqueta: etiqueta(n), tema: p || tema ? tema : null };
    });
    const t = new Map<string, string>();
    for (const n of nosCalc) if (n.tema && !t.has(n.tema)) t.set(n.tema, n.cor);
    return { nos: nosCalc, arestas: arestasVisiveis, temas: [...t.entries()].slice(0, 8) };
  }, [agora, notas, conexoes, periodo, tag, grupos, soConectadas]);

  const porId = useMemo(() => new Map(nos.map((n) => [n.nota.id, n])), [nos]);
  const foco = hover ?? (sel?.tipo === "no" ? sel.id : null);
  const vizinhos = useMemo(() => {
    const s = new Set<string>();
    if (!foco) return s;
    s.add(foco);
    for (const e of arestas) {
      if (e.a === foco) s.add(e.b);
      if (e.b === foco) s.add(e.a);
    }
    return s;
  }, [foco, arestas]);
  const arestaSel = sel?.tipo === "aresta" ? arestas.find((e) => e.chave === sel.id) : undefined;
  const noSel = sel?.tipo === "no" ? porId.get(sel.id) : undefined;

  const mostrarRotulos = nos.length <= 36;
  const w = L / zoom;
  const h = A / zoom;
  const viewBox = `${(L - w) / 2} ${(A - h) / 2} ${w} ${h}`;

  const chip = (ativo: boolean) => `press rounded-full border px-3 py-1 text-sm ${ativo ? "border-accent bg-accent text-paper" : "border-line text-muted hover:text-ink"}`;

  function conexoesDoNo(id: string) {
    return arestas
      .filter((e) => e.a === id || e.b === id)
      .map((e) => ({ aresta: e, outro: e.a === id ? e.b : e.a }))
      .sort((x, y) => y.aresta.peso - x.aresta.peso);
  }

  return (
    <div>
      <h1 className="font-serif text-3xl">Map</h1>
      <p className="mt-1 text-muted">Tap a link to see why the two notes connect.</p>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => <button key={p.id} onClick={() => setPeriodo(p.id)} className={chip(periodo === p.id)}>{p.nome}</button>)}
        </div>
        {todasTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTag(null)} className={chip(!tag)}>All tags</button>
            {todasTags.map((t) => <button key={t} onClick={() => setTag(tag === t ? null : t)} className={chip(tag === t)}>#{t}</button>)}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(Object.keys(ROTULO_GRUPO) as GrupoConexao[]).map((g) => (
            <button key={g} onClick={() => setGrupos((s) => ({ ...s, [g]: !s[g] }))} aria-pressed={grupos[g]}
              className={`press inline-flex items-center gap-2 rounded-full border px-3 py-1 ${grupos[g] ? "border-line text-ink" : "border-line text-muted opacity-60"}`}>
              <svg width="26" height="8" aria-hidden="true"><line x1="1" y1="4" x2="25" y2="4" stroke={ESTILO_GRUPO[g].cor} strokeWidth="2.4" strokeDasharray={ESTILO_GRUPO[g].dash} strokeLinecap="round" /></svg>
              {ROTULO_GRUPO[g].nome}
            </button>
          ))}
          <label className="ml-1 inline-flex items-center gap-2 text-muted">
            <input type="checkbox" checked={soConectadas} onChange={(e) => setSoConectadas(e.target.checked)} className="accent-[var(--accent)]" />
            Connected notes only
          </label>
        </div>
      </div>

      {erro && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm">{erro}</p>}
      {!notas && <p className="mt-8"><Pensando texto="Building the map" /></p>}

      {notas && (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
            {nos.length === 0 ? (
              <p className="p-10 text-center text-muted">{notas.length === 0 ? "The map appears once you write your first notes." : "Nothing in this selection."}</p>
            ) : (
              <svg viewBox={viewBox} className="block h-auto w-full touch-manipulation" role="img" aria-label="Map of connections between your notes" onClick={() => setSel(null)}>
                <g>
                  {arestas.map((e) => {
                    const a = porId.get(e.a)!;
                    const b = porId.get(e.b)!;
                    const est = ESTILO_GRUPO[e.grupo];
                    const ativa = sel?.tipo === "aresta" && sel.id === e.chave;
                    const dim = foco ? !(e.a === foco || e.b === foco) : sel?.tipo === "aresta" ? !ativa : false;
                    return (
                      <g key={e.chave} className="anim-fade-in" style={{ opacity: dim ? 0.12 : 1, transition: "opacity .2s" }}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={est.cor} strokeDasharray={est.dash} strokeLinecap="round"
                          strokeWidth={(ativa ? 2 : 1) + 2.2 * e.peso} opacity={ativa ? 1 : 0.75} />
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16} className="cursor-pointer"
                          onClick={(ev) => { ev.stopPropagation(); setSel({ tipo: "aresta", id: e.chave }); }}>
                          <title>{e.conexoes.map((c) => c.motivo).join(" · ")}</title>
                        </line>
                        {e.conexoes.length > 1 && (
                          <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`} pointerEvents="none">
                            <circle r="8" fill="var(--card)" stroke={est.cor} />
                            <text textAnchor="middle" dy="3.5" fontSize="10" fill="var(--ink)">{e.conexoes.length}</text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
                <g>
                  {nos.map((n, i) => {
                    const p = passagemPrincipal(n.nota);
                    const ativo = sel?.tipo === "no" && sel.id === n.nota.id;
                    const dim = foco ? !vizinhos.has(n.nota.id) : false;
                    const mostra = mostrarRotulos || vizinhos.has(n.nota.id) || ativo;
                    return (
                      <g key={n.nota.id} transform={`translate(${n.x} ${n.y})`} style={{ opacity: dim ? 0.25 : 1, transition: "opacity .2s" }}
                        className="cursor-pointer"
                        onMouseEnter={() => setHover(n.nota.id)} onMouseLeave={() => setHover(null)}
                        onClick={(ev) => { ev.stopPropagation(); setSel({ tipo: "no", id: n.nota.id }); }}>
                        <g className="anim-pop" style={{ animationDelay: `${Math.min(i, 30) * 25}ms` }}>
                          {ativo && <circle r={n.r + 9} fill={n.cor} className="anim-breathe" />}
                          {p?.sugerida && <circle r={n.r + 4} fill="none" stroke={n.cor} strokeDasharray="3 3" strokeWidth="1.4" />}
                          <circle r={n.r} fill={n.cor} stroke="var(--card)" strokeWidth="2.5" />
                          {p && <text textAnchor="middle" dy={n.r > 15 ? 5 : 4} fontSize={n.r > 15 ? 14 : 11} fill="#fffdf8" pointerEvents="none">{p.sugerida ? "✦" : "❖"}</text>}
                          {mostra && (
                            <text y={n.r + 14} textAnchor="middle" fontSize="11" fill="var(--ink)" stroke="var(--card)" strokeWidth="3" paintOrder="stroke" pointerEvents="none">
                              {n.etiqueta}
                            </text>
                          )}
                          <title>{n.nota.conteudo.slice(0, 120)}</title>
                        </g>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}

            <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-line bg-card/95 text-lg shadow-sm">
              <button onClick={() => setZoom((z) => Math.min(2.2, z + 0.25))} className="press px-3 py-1 hover:bg-accent-soft" aria-label="Zoom in">+</button>
              <button onClick={() => setZoom((z) => Math.max(0.8, z - 0.25))} className="press border-t border-line px-3 py-1 hover:bg-accent-soft" aria-label="Zoom out">−</button>
            </div>
          </div>

          {(noSel || arestaSel) && (
            <aside key={sel?.id} className="anim-panel fixed inset-x-0 bottom-16 z-20 max-h-[62vh] overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-2xl md:static md:z-auto md:max-h-[640px] md:rounded-2xl md:shadow-none">
              <button onClick={() => setSel(null)} className="press float-right text-sm text-muted hover:text-ink" aria-label="Close">Close ✕</button>

              {noSel && (
                <div className="space-y-4">
                  <p className="text-xs text-muted">{formatarData(noSel.nota.created_at)}</p>
                  <p className="whitespace-pre-wrap font-serif leading-relaxed">{noSel.nota.conteudo}</p>
                  <div className="flex flex-wrap gap-2">
                    {noSel.nota.sc_nota_refs.map((r) => <Passagem key={r.rotulo} rotulo={r.rotulo} sugerida={r.origem === "ia"} motivo={noSel.nota.passagem_ia?.motivo} />)}
                  </div>
                  {noSel.nota.tags.length > 0 && <p className="flex flex-wrap gap-1.5 text-xs text-muted">{noSel.nota.tags.map((t) => <span key={t}>#{t}</span>)}</p>}
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Why it&apos;s linked</p>
                    {conexoesDoNo(noSel.nota.id).length === 0 && <p className="text-sm text-muted">No connections in this selection.</p>}
                    <ul className="space-y-2">
                      {conexoesDoNo(noSel.nota.id).map(({ aresta, outro }) => {
                        const o = porId.get(outro);
                        return (
                          <li key={aresta.chave}>
                            <button onClick={() => setSel({ tipo: "aresta", id: aresta.chave })} className="press block w-full rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-accent/50">
                              {aresta.conexoes.map((c) => (
                                <span key={c.id} className="block"><span className={`text-xs font-medium uppercase tracking-wide ${ROTULO_GRUPO[GRUPO[c.tipo]].cor}`}>{ROTULO_GRUPO[GRUPO[c.tipo]].nome}</span> {c.motivo}</span>
                              ))}
                              {o && <span className="mt-1 line-clamp-1 block text-muted">{o.nota.conteudo}</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <Link href={`/notas#${noSel.nota.id}`} className="press inline-block text-sm font-medium text-accent hover:underline">Open note →</Link>
                </div>
              )}

              {arestaSel && (
                <div className="space-y-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Why these notes link</p>
                  <ul className="space-y-2">
                    {arestaSel.conexoes.map((c) => (
                      <li key={c.id} className="rounded-xl bg-accent-soft p-3 text-sm">
                        <span className={`text-xs font-medium uppercase tracking-wide ${ROTULO_GRUPO[GRUPO[c.tipo]].cor}`}>{ROTULO_GRUPO[GRUPO[c.tipo]].nome}</span>
                        <span className="block">{c.motivo}</span>
                      </li>
                    ))}
                  </ul>
                  {[arestaSel.a, arestaSel.b].map((id) => {
                    const n = porId.get(id);
                    if (!n) return null;
                    return (
                      <button key={id} onClick={() => setSel({ tipo: "no", id })} className="press block w-full rounded-xl border border-line p-3 text-left text-sm hover:border-accent/50">
                        <span className="text-xs text-muted">{formatarData(n.nota.created_at)} · {n.etiqueta}</span>
                        <span className="mt-1 line-clamp-3 block font-serif">{n.nota.conteudo}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {nos.length > 0 && (
        <div className="anim-fade-in mt-4 rounded-2xl border border-line bg-card p-4 text-xs text-muted">
          <p className="font-medium text-ink">How to read the map</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <li><span aria-hidden="true">❖</span> note with your passage · <span aria-hidden="true">✦</span> suggested passage (dashed ring)</li>
            <li>Size = how many links the note has</li>
            <li>Color = main theme (first tag or book)</li>
            <li>Solid line = meaning · dashed = passage · dotted = theme</li>
          </ul>
          {temas.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {temas.map(([t, c]) => <span key={t} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} aria-hidden="true" />{t}</span>)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
