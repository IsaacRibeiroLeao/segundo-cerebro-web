"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatarData, parseLista, processarNota } from "@/lib/cerebro";
import { COLUNAS_NOTA, type Fonte, type Nota } from "@/lib/types";
import { ListaFontes, TextoComCitacoes } from "@/components/Citacoes";

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function Hoje() {
  const [conteudo, setConteudo] = useState("");
  const [refs, setRefs] = useState("");
  const [tags, setTags] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reflexao, setReflexao] = useState<{ texto: string; fontes: Fonte[]; notaId: string } | null>(null);
  const [recentes, setRecentes] = useState<Nota[]>([]);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("sc_notas")
      .select(COLUNAS_NOTA)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentes((data ?? []) as Nota[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  async function conectar(notaId: string) {
    try {
      const r = await processarNota(notaId);
      setReflexao({ texto: r.reflexao, fontes: r.fontes, notaId });
    } catch (e) {
      setErro(`Nota guardada, mas não consegui conectar agora: ${(e as Error).message}`);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!conteudo.trim()) return;
    setErro(null);
    setReflexao(null);
    setSalvando(true);
    const { data, error } = await supabase
      .from("sc_notas")
      .insert({
        conteudo: conteudo.trim(),
        referencias: parseLista(refs),
        tags: parseLista(tags, true),
      })
      .select("id")
      .single();
    if (error || !data) {
      setErro(error?.message ?? "Não foi possível salvar.");
      setSalvando(false);
      return;
    }
    setConteudo("");
    setRefs("");
    setTags("");
    await conectar(data.id);
    await carregar();
    setSalvando(false);
  }

  return (
    <div>
      <p className="text-sm text-muted">
        {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="mt-1 font-serif text-3xl md:text-4xl">{saudacao()}.</h1>
      <p className="mt-2 text-muted">O que você leu ou sentiu hoje?</p>

      <form onSubmit={salvar} className="mt-6 rounded-2xl border border-line bg-card p-4 md:p-5">
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Escreva aqui o que o Espírito Santo falou ao seu coração…"
          rows={5}
          className="w-full resize-y bg-transparent font-serif text-lg leading-relaxed outline-none placeholder:text-muted/70"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={refs}
            onChange={(e) => setRefs(e.target.value)}
            placeholder="Referências (João 15:5, Sl 23)"
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (fé, obediência)"
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Ao guardar, conecto com o que você já escreveu.</p>
          <button
            disabled={salvando || !conteudo.trim()}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
          >
            {salvando ? "Conectando…" : "Guardar e conectar"}
          </button>
        </div>
      </form>

      {erro && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-ink">{erro}</p>}

      {reflexao && (
        <section className="mt-6 rounded-2xl border border-accent/40 bg-accent-soft p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Conexões</p>
          <div className="mt-2">
            <TextoComCitacoes texto={reflexao.texto} fontes={reflexao.fontes} />
          </div>
          <ListaFontes fontes={reflexao.fontes} />
          <Link
            href="/conversar"
            className="mt-4 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Quero pensar mais sobre isso →
          </Link>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl">Últimas anotações</h2>
          <Link href="/notas" className="text-sm text-muted hover:text-ink">
            Ver todas
          </Link>
        </div>
        {recentes.length === 0 ? (
          <div className="mt-4 flex flex-col items-center text-center">
            <Image src="/icons/ilustracao-vazio.png" alt="" width={220} height={220} />
            <p className="mt-2 text-muted">Sua primeira anotação começa aqui.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notas#${n.id}`}
                  className="block rounded-2xl border border-line bg-card p-4 hover:border-accent/50"
                >
                  <p className="text-xs text-muted">
                    {formatarData(n.created_at)}
                    {n.referencias.length ? ` · ${n.referencias.join(", ")}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-3 font-serif">{n.conteudo}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
