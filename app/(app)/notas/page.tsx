"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buscar, formatarData, parseLista, processarNota } from "@/lib/cerebro";
import { baixar, exportarMarkdown, useDados } from "@/lib/dados";
import type { Conexao, Nota, Reflexao } from "@/lib/types";
import { ListaConexoes } from "@/components/Conexoes";
import { Icon } from "@/components/Icon";
import { Passagem } from "@/components/Passagem";
import { Pensando } from "@/components/Pensando";
import { TagsSugeridas } from "@/components/TagsSugeridas";

const ORIGEM: Record<Reflexao["origem"], string> = { auto: "Ao guardar", edicao: "Após editar", manual: "Pedida por você" };

function Cartao({
  nota, notas, conexoes, aberta, destaque, aoAlternar, recarregar, indice,
}: {
  nota: Nota; notas: Nota[]; conexoes: Conexao[]; aberta: boolean; destaque: boolean;
  aoAlternar: () => void; recarregar: () => Promise<void>; indice: number;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.conteudo);
  const [refs, setRefs] = useState(nota.referencias.join(", "));
  const [tags, setTags] = useState(nota.tags.join(", "));
  const [ocupado, setOcupado] = useState<null | "salvando" | "refletindo">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versoes, setVersoes] = useState<Reflexao[] | null>(null);
  const [confirmaApagar, setConfirmaApagar] = useState(false);

  const nConexoes = conexoes.filter((c) => c.a === nota.id || c.b === nota.id).length;
  const refsIa = nota.sc_nota_refs.filter((r) => r.origem === "ia");
  const refsUsuario = nota.sc_nota_refs.filter((r) => r.origem === "usuario");

  async function carregarVersoes() {
    const { data } = await supabase
      .from("sc_reflexoes").select("id, texto, origem, created_at").eq("nota_id", nota.id).order("created_at", { ascending: false });
    setVersoes((data ?? []) as Reflexao[]);
  }

  async function salvarEdicao() {
    if (!texto.trim()) return;
    setErro(null);
    setOcupado("salvando");
    const { error } = await supabase
      .from("sc_notas")
      .update({ conteudo: texto.trim(), referencias: parseLista(refs), tags: parseLista(tags, true), processada_em: null })
      .eq("id", nota.id);
    if (error) {
      setErro(error.message);
      setOcupado(null);
      return;
    }
    setEditando(false);
    setOcupado("refletindo");
    try {
      await processarNota(nota.id, "edicao");
    } catch (e) {
      setErro(`Alterações salvas, mas a nova reflexão falhou: ${(e as Error).message}`);
    }
    setVersoes(null);
    await recarregar();
    setOcupado(null);
  }

  async function novaReflexao() {
    setErro(null);
    setOcupado("refletindo");
    try {
      await processarNota(nota.id, "manual");
      setVersoes(null);
    } catch (e) {
      setErro((e as Error).message);
    }
    await recarregar();
    setOcupado(null);
  }

  async function apagar() {
    const { error } = await supabase.from("sc_notas").delete().eq("id", nota.id);
    if (error) setErro(error.message);
    else await recarregar();
  }

  return (
    <li
      id={nota.id}
      className={`anim-fade-up scroll-mt-6 rounded-2xl border bg-card transition-colors ${destaque ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line"}`}
      style={{ animationDelay: `${Math.min(indice, 8) * 40}ms` }}
    >
      <button onClick={aoAlternar} aria-expanded={aberta} className="block w-full p-4 text-left">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{formatarData(nota.created_at)}</span>
          {refsUsuario.map((r) => <span key={r.rotulo} className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">{r.rotulo}</span>)}
          {refsIa.map((r) => <span key={r.rotulo} className="rounded-full border border-dashed border-sage px-2 py-0.5 text-sage">✦ {r.rotulo}</span>)}
          {nConexoes > 0 && <span className="ml-auto">{nConexoes} {nConexoes === 1 ? "conexão" : "conexões"}</span>}
        </div>
        <p className={`mt-2 whitespace-pre-wrap font-serif leading-relaxed ${aberta ? "" : "line-clamp-3"}`}>{nota.conteudo}</p>
        {nota.tags.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">{nota.tags.map((t) => <span key={t}>#{t}</span>)}</p>
        )}
      </button>

      {aberta && (
        <div className="anim-fade-in space-y-5 border-t border-line p-4">
          {editando ? (
            <div className="space-y-2">
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
                className="w-full resize-y rounded-xl border border-line bg-paper p-3 font-serif leading-relaxed outline-none focus:border-accent" />
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={refs} onChange={(e) => setRefs(e.target.value)} placeholder="Passagem (opcional)"
                  className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags"
                  className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
              </div>
              <div className="flex gap-2">
                <button onClick={salvarEdicao} disabled={!texto.trim() || ocupado !== null} className="press btn-accent rounded-xl px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">Salvar e refazer reflexão</button>
                <button onClick={() => setEditando(false)} className="press rounded-xl px-4 py-2 text-sm text-muted hover:text-ink">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              {(refsUsuario.length > 0 || refsIa.length > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Passagem e contexto</p>
                  <div className="flex flex-wrap gap-2">
                    {refsUsuario.map((r) => <Passagem key={r.rotulo} rotulo={r.rotulo} />)}
                    {refsIa.map((r) => <Passagem key={r.rotulo} rotulo={r.rotulo} sugerida motivo={nota.passagem_ia?.motivo} />)}
                  </div>
                </div>
              )}

              <TagsSugeridas nota={nota} aoMudar={recarregar} />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Reflexão</p>
                {ocupado === "refletindo" ? (
                  <p className="mt-2"><Pensando texto="Pensando de novo sobre esta nota" /></p>
                ) : nota.reflexao ? (
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed">{nota.reflexao.replace(/\s?\[\d+\]/g, "")}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted">Ainda sem reflexão.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <button onClick={novaReflexao} disabled={ocupado !== null} className="press inline-flex items-center gap-1.5 text-accent hover:underline disabled:opacity-50">
                    <Icon nome="refazer" className="h-4 w-4" /> Gerar nova reflexão
                  </button>
                  <button onClick={() => (versoes ? setVersoes(null) : carregarVersoes())} className="press text-muted hover:text-ink">
                    {versoes ? "Ocultar versões" : "Ver versões"}
                  </button>
                </div>
                {versoes && (
                  <ul className="anim-fade-up mt-3 space-y-2">
                    {versoes.length === 0 && <li className="text-sm text-muted">Nenhuma versão guardada ainda.</li>}
                    {versoes.map((v, i) => (
                      <li key={v.id} className="rounded-xl border border-line bg-paper p-3 text-sm">
                        <p className="text-xs text-muted">{i === 0 ? "Atual · " : ""}{ORIGEM[v.origem]} · {formatarData(v.created_at)}</p>
                        <p className="mt-1 whitespace-pre-wrap">{v.texto.replace(/\s?\[\d+\]/g, "")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Por que está ligada a outras notas</p>
                <ListaConexoes notaId={nota.id} conexoes={conexoes} notas={notas} />
              </div>

              <div className="flex items-center gap-4 border-t border-line pt-3 text-sm">
                <button onClick={() => setEditando(true)} className="press inline-flex items-center gap-1.5 text-muted hover:text-ink"><Icon nome="editar" className="h-4 w-4" /> Editar</button>
                {confirmaApagar ? (
                  <span className="anim-fade-in inline-flex items-center gap-3">
                    <button onClick={apagar} className="press font-medium text-red-700 dark:text-red-300">Apagar de vez</button>
                    <button onClick={() => setConfirmaApagar(false)} className="press text-muted">Cancelar</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmaApagar(true)} className="press inline-flex items-center gap-1.5 text-muted hover:text-ink"><Icon nome="apagar" className="h-4 w-4" /> Apagar</button>
                )}
              </div>
            </>
          )}
          {erro && <p className="rounded-xl bg-accent-soft p-3 text-sm">{erro}</p>}
        </div>
      )}
    </li>
  );
}

export default function Notas() {
  const { notas, conexoes, erro, recarregar } = useDados();
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<{ ids: string[]; semantica: boolean } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [menuExport, setMenuExport] = useState(false);
  const rolou = useRef(false);

  // Busca híbrida (texto + sentido), com pequeno atraso para não gastar cota a cada tecla.
  useEffect(() => {
    const q = busca.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAchados(null);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscar(q);
        setAchados({ ids: r.resultados.map((x) => x.id), semantica: r.semantica });
      } catch {
        const min = q.toLowerCase();
        setAchados({ ids: (notas ?? []).filter((n) => n.conteudo.toLowerCase().includes(min)).map((n) => n.id), semantica: false });
      }
      setBuscando(false);
    }, 600);
    return () => clearTimeout(t);
  }, [busca, notas]);

  // Abre e rola até a nota indicada em #id.
  const irParaHash = useCallback(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    setAberta(id);
    setDestaque(id);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    setTimeout(() => setDestaque(null), 2500);
  }, []);
  useEffect(() => {
    if (notas && !rolou.current) {
      rolou.current = true;
      irParaHash();
    }
  }, [notas, irParaHash]);
  useEffect(() => {
    window.addEventListener("hashchange", irParaHash);
    return () => window.removeEventListener("hashchange", irParaHash);
  }, [irParaHash]);

  const todasTags = useMemo(() => {
    const f = new Map<string, number>();
    for (const n of notas ?? []) for (const t of n.tags) f.set(t, (f.get(t) ?? 0) + 1);
    return [...f.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [notas]);

  const lista = useMemo(() => {
    let base = notas ?? [];
    if (achados) {
      const ordem = new Map(achados.ids.map((id, i) => [id, i]));
      base = base.filter((n) => ordem.has(n.id)).sort((a, b) => ordem.get(a.id)! - ordem.get(b.id)!);
    }
    return tag ? base.filter((n) => n.tags.includes(tag)) : base;
  }, [notas, achados, tag]);

  function exportar(formato: "md" | "json") {
    const dia = new Date().toISOString().slice(0, 10);
    if (formato === "md") baixar(`segundo-cerebro-${dia}.md`, exportarMarkdown(notas ?? []), "text/markdown");
    else baixar(`segundo-cerebro-${dia}.json`, JSON.stringify({ notas, conexoes }, null, 2), "application/json");
    setMenuExport(false);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl">Notas</h1>
        <div className="relative">
          <button onClick={() => setMenuExport((v) => !v)} disabled={!notas?.length} className="press inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink disabled:opacity-40">
            <Icon nome="baixar" className="h-4 w-4" /> Exportar
          </button>
          {menuExport && (
            <div className="anim-fade-up absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-card text-sm shadow-lg">
              <button onClick={() => exportar("md")} className="block w-full px-4 py-2.5 text-left hover:bg-accent-soft">Markdown (.md)</button>
              <button onClick={() => exportar("json")} className="block w-full px-4 py-2.5 text-left hover:bg-accent-soft">Completo (.json)</button>
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-4">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por palavra ou por ideia…"
          className="w-full rounded-xl border border-line bg-card px-4 py-3 outline-none transition focus:border-accent" />
        {buscando && <span className="absolute right-4 top-3.5 text-xs text-muted">buscando…</span>}
      </div>
      {achados && !achados.semantica && <p className="mt-2 text-xs text-muted">Busca só por palavras agora (a busca por sentido está indisponível no momento).</p>}

      {todasTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {todasTags.map((t) => (
            <button key={t} onClick={() => setTag(tag === t ? null : t)}
              className={`press rounded-full border px-3 py-1 text-sm ${tag === t ? "border-accent bg-accent text-paper" : "border-line text-muted hover:text-ink"}`}>#{t}</button>
          ))}
        </div>
      )}

      {erro && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm">{erro}</p>}
      {!notas && <p className="mt-8 text-muted"><Pensando texto="Carregando" /></p>}
      {notas && lista.length === 0 && (
        <p className="anim-fade-in mt-8 text-center text-muted">{notas.length === 0 ? "Você ainda não escreveu nenhuma nota." : "Nada encontrado."}</p>
      )}

      <ul className="mt-5 space-y-3">
        {lista.map((n, i) => (
          <Cartao key={n.id} nota={n} notas={notas ?? []} conexoes={conexoes} indice={i}
            aberta={aberta === n.id} destaque={destaque === n.id}
            aoAlternar={() => setAberta(aberta === n.id ? null : n.id)} recarregar={recarregar} />
        ))}
      </ul>
    </div>
  );
}
