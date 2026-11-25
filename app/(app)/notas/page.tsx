"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatarData, parseLista, processarNota, reprocessarPendentes } from "@/lib/cerebro";
import { COLUNAS_NOTA, type Fonte, type Nota } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { ListaFontes } from "@/components/Citacoes";

export default function Notas() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("sc_notas")
      .select(COLUNAS_NOTA)
      .order("created_at", { ascending: false });
    setNotas((data ?? []) as Nota[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (carregando) return;
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDestaque(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [carregando]);

  const todasTags = useMemo(() => {
    const cont = new Map<string, number>();
    notas.forEach((n) => n.tags.forEach((t) => cont.set(t, (cont.get(t) ?? 0) + 1)));
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [notas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return notas.filter(
      (n) =>
        (!tag || n.tags.includes(tag)) &&
        (!q ||
          n.conteudo.toLowerCase().includes(q) ||
          n.referencias.some((r) => r.toLowerCase().includes(q)) ||
          n.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [notas, busca, tag]);

  return (
    <div>
      <h1 className="font-serif text-3xl">Notas</h1>
      <p className="mt-1 text-muted">{notas.length} anotações</p>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por palavra, versículo ou tag…"
        className="mt-5 w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-accent"
      />

      {todasTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {todasTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`rounded-full px-3 py-1 text-sm ${
                tag === t ? "bg-accent text-paper" : "bg-accent-soft text-accent"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <PendentesAviso onFeito={carregar} />

      {carregando ? (
        <p className="mt-8 text-muted">Carregando…</p>
      ) : filtradas.length === 0 ? (
        <div className="mt-8 flex flex-col items-center text-center">
          {notas.length === 0 && <Image src="/icons/ilustracao-vazio.png" alt="" width={220} height={220} />}
          <p className="mt-2 text-muted">{notas.length === 0 ? "Nenhuma anotação ainda." : "Nenhuma nota encontrada."}</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {filtradas.map((n) => (
            <NotaCard key={n.id} nota={n} destacada={destaque === n.id} aoMudar={carregar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PendentesAviso({ onFeito }: { onFeito: () => void }) {
  const [pendentes, setPendentes] = useState(0);
  const [rodando, setRodando] = useState(false);

  useEffect(() => {
    supabase
      .from("sc_notas")
      .select("id", { count: "exact", head: true })
      .is("embedding", null)
      .then(({ count }) => setPendentes(count ?? 0));
  }, []);

  if (!pendentes) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-accent-soft p-3 text-sm">
      <span>{pendentes} nota(s) ainda sem conexões.</span>
      <button
        disabled={rodando}
        onClick={async () => {
          setRodando(true);
          try {
            await reprocessarPendentes();
            setPendentes(0);
            onFeito();
          } catch {
            /* tenta de novo depois */
          }
          setRodando(false);
        }}
        className="rounded-lg bg-accent px-3 py-1.5 font-medium text-paper disabled:opacity-60"
      >
        {rodando ? "Conectando…" : "Conectar agora"}
      </button>
    </div>
  );
}

function NotaCard({ nota, destacada, aoMudar }: { nota: Nota; destacada: boolean; aoMudar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.conteudo);
  const [refs, setRefs] = useState(nota.referencias.join(", "));
  const [tags, setTags] = useState(nota.tags.join(", "));
  const [parecidas, setParecidas] = useState<Fonte[] | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setOcupado(true);
    await supabase
      .from("sc_notas")
      .update({
        conteudo: texto.trim(),
        referencias: parseLista(refs),
        tags: parseLista(tags, true),
        embedding: null,
        reflexao: null,
      })
      .eq("id", nota.id);
    try {
      await processarNota(nota.id);
    } catch {
      /* fica pendente */
    }
    setEditando(false);
    setOcupado(false);
    aoMudar();
  }

  async function apagar() {
    if (!window.confirm("Apagar esta nota? Isso não pode ser desfeito.")) return;
    await supabase.from("sc_notas").delete().eq("id", nota.id);
    aoMudar();
  }

  async function verParecidas() {
    setOcupado(true);
    try {
      const r = await processarNota(nota.id);
      setParecidas(r.fontes);
      aoMudar();
    } catch {
      setParecidas([]);
    }
    setOcupado(false);
  }

  return (
    <li
      id={nota.id}
      className={`scroll-mt-24 rounded-2xl border bg-card p-4 md:p-5 ${
        destacada ? "border-accent ring-2 ring-accent/30" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted">
          {formatarData(nota.created_at)}
          {nota.referencias.length ? ` · ${nota.referencias.join(", ")}` : ""}
        </p>
        <div className="flex gap-1 text-muted">
          <button onClick={() => setEditando(!editando)} aria-label="Editar" className="p-1 hover:text-ink">
            <Icon nome="editar" className="w-4 h-4" />
          </button>
          <button onClick={apagar} aria-label="Apagar" className="p-1 hover:text-red-600">
            <Icon nome="apagar" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editando ? (
        <div className="mt-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-line bg-paper p-3 font-serif outline-none focus:border-accent"
          />
          <input
            value={refs}
            onChange={(e) => setRefs(e.target.value)}
            placeholder="Referências"
            className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags"
            className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-3 flex gap-2">
            <button
              disabled={ocupado || !texto.trim()}
              onClick={salvar}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
            >
              {ocupado ? "Salvando…" : "Salvar"}
            </button>
            <button onClick={() => setEditando(false)} className="px-3 text-sm text-muted">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap font-serif text-lg leading-relaxed">{nota.conteudo}</p>
      )}

      {nota.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {nota.tags.map((t) => (
            <span key={t} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">
              #{t}
            </span>
          ))}
        </div>
      )}

      {nota.reflexao && !editando && (
        <details className="mt-4 rounded-xl bg-paper p-3">
          <summary className="cursor-pointer text-sm font-medium text-sage">Reflexão do segundo cérebro</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{nota.reflexao}</p>
        </details>
      )}

      {!editando && (
        <div className="mt-3">
          <button
            disabled={ocupado}
            onClick={verParecidas}
            className="text-sm font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50"
          >
            {ocupado ? "Buscando…" : "Ver notas parecidas"}
          </button>
          {parecidas && (
            <div className="mt-2">
              {parecidas.length ? (
                <ListaFontes fontes={parecidas} />
              ) : (
                <p className="text-sm text-muted">Nenhuma conexão encontrada ainda.</p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
