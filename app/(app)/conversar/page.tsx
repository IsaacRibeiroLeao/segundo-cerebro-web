"use client";

import { useEffect, useRef, useState } from "react";
import { conversar, processarNota, prosear } from "@/lib/cerebro";
import { supabase } from "@/lib/supabase";
import type { Mensagem, Percepcao } from "@/lib/types";
import { ListaFontes, TextoComCitacoes } from "@/components/Citacoes";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";

const SUGESTOES = [
  "O que mais se repete nas minhas anotações?",
  "Quais temas Deus tem tratado comigo ultimamente?",
  "Como o que escrevi sobre fé se liga ao que escrevi sobre obediência?",
  "Onde eu vejo tensão ou contradição nas minhas notas?",
];

const CHAVE = "sc_chat_v1";
const CHAVE_PROSA = "sc_prosa_v1";
const CHAVE_MODO = "sc_chat_modo_v1";
const ABERTURAS = ["Estou aqui. O que ficou no seu coração hoje?", "Sobre o que você está pensando ultimamente?", "Teve algo na leitura que não saiu da sua cabeça?"];

export default function Conversar() {
  const [modo, setModo] = useState<"conversa" | "notas">("conversa");
  const [carregado, setCarregado] = useState(false);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const m = localStorage.getItem(CHAVE_MODO) === "notas" ? "notas" : "conversa";
      const salvo = localStorage.getItem(m === "notas" ? CHAVE : CHAVE_PROSA);
      /* eslint-disable react-hooks/set-state-in-effect */
      setModo(m);
      if (salvo) setMsgs(JSON.parse(salvo));
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* ignora */
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(modo === "notas" ? CHAVE : CHAVE_PROSA, JSON.stringify(msgs.slice(-40)));
    } catch {
      /* ignora */
    }
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, modo, carregado]);

  function trocarModo(novo: "conversa" | "notas") {
    if (novo === modo) return;
    try {
      localStorage.setItem(CHAVE_MODO, novo);
      const salvo = localStorage.getItem(novo === "notas" ? CHAVE : CHAVE_PROSA);
      setMsgs(salvo ? JSON.parse(salvo) : []);
    } catch {
      setMsgs([]);
    }
    setErro(null);
    setModo(novo);
  }

  async function decidirPercepcao(i: number, p: Percepcao, guardar: boolean) {
    if (guardar) {
      const { data, error } = await supabase
        .from("sc_notas")
        .insert({ conteudo: `Percepção numa conversa: ${p.texto}`, referencias: p.passagem ? [p.passagem] : [], tags: ["percepção"] })
        .select("id")
        .single();
      if (error || !data) { setErro(error?.message ?? "Não foi possível guardar."); return; }
      void processarNota(data.id).catch(() => undefined);
    }
    setMsgs((m) => m.map((x, j) => (j === i && x.percepcao ? { ...x, percepcao: { ...x.percepcao, estado: guardar ? "guardada" : "dispensada" } } : x)));
  }

  async function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || enviando) return;
    setErro(null);
    setTexto("");
    const historico = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setEnviando(true);
    try {
      if (modo === "conversa") {
        const r = await prosear(q, historico);
        setMsgs((m) => [...m, { role: "assistant", content: r.resposta, fontes: r.fontes, percepcao: r.percepcao }]);
      } else {
        const r = await conversar(q, historico);
        setMsgs((m) => [...m, { role: "assistant", content: r.resposta, fontes: r.fontes }]);
      }
    } catch (e) {
      setErro((e as Error).message);
    }
    setEnviando(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col md:min-h-[calc(100vh-6rem)]">
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Conversar</h1>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} className="text-sm text-muted hover:text-ink">
            Nova conversa
          </button>
        )}
      </div>
      <div role="tablist" className="mt-3 inline-flex rounded-2xl border border-line bg-card p-1 text-sm">
        {([["conversa", "Conversa"], ["notas", "Perguntar às notas"]] as const).map(([k, nome]) => (
          <button key={k} role="tab" aria-selected={modo === k} onClick={() => trocarModo(k)}
            className={`press rounded-xl px-3 py-1.5 transition ${modo === k ? "btn-accent font-medium" : "text-muted"}`}>{nome}</button>
        ))}
      </div>
      <p className="mt-2 text-muted">{modo === "conversa" ? "Converse como com um amigo. Se eu perceber algo, aviso." : "Pense junto com as suas anotações."}</p>

      <div className="mt-6 flex-1 space-y-5">
        {msgs.length === 0 && modo === "conversa" && (
          <div className="grid gap-2">
            {ABERTURAS.map((s) => (
              <button key={s} onClick={() => enviar(s)} className="press lift rounded-2xl border border-line bg-card px-4 py-3 text-left text-sm hover:border-accent/60">{s}</button>
            ))}
            <p className="mt-2 text-xs text-muted">Eu escuto, lembro do que você já escreveu e, de vez em quando, devolvo uma percepção. Ela é uma hipótese para você levar em oração; quem discerne é você.</p>
          </div>
        )}
        {msgs.length === 0 && modo === "notas" && (
          <div className="grid gap-2">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="press lift rounded-2xl border border-line bg-card px-4 py-3 text-left text-sm hover:border-accent/60"
              >
                {s}
              </button>
            ))}
            <p className="mt-2 text-xs text-muted">
              Eu respondo com base no que você escreveu, e levanto conexões e perguntas. A interpretação
              continua sendo sua.
            </p>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="anim-fade-up ml-auto flex max-w-[88%] items-end gap-2">
              <div className="rounded-2xl rounded-br-md bg-accent px-4 py-3 text-paper shadow-sm">
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              <Avatar tamanho={28} />
            </div>
          ) : (
            <div key={i} className="anim-fade-up flex max-w-[94%] items-end gap-2">
              <Image src="/logo.png" alt="" width={28} height={28} className="shrink-0 rounded-full" />
              <div className="min-w-0 rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 shadow-sm">
                <TextoComCitacoes texto={m.content} fontes={m.fontes ?? []} />
                <ListaFontes fontes={(m.fontes ?? []).filter((f) => m.content.includes(`[${f.n}]`))} />
                {m.percepcao && m.percepcao.estado !== "dispensada" && (
                  <div className="cartao-ouro anim-fade-up mt-3 rounded-xl p-3 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-accent">✦ Percebi algo</p>
                    <p className="mt-1 font-serif leading-relaxed">{m.percepcao.texto}</p>
                    {m.percepcao.passagem && <p className="mt-1 text-xs text-muted">{m.percepcao.passagem}</p>}
                    {m.percepcao.estado === "guardada" ? (
                      <p className="mt-2 text-xs text-accent">✓ Guardada nas suas notas</p>
                    ) : (
                      <div className="mt-2 flex gap-3">
                        <button onClick={() => decidirPercepcao(i, m.percepcao!, true)} className="press font-medium text-accent">Guardar como nota</button>
                        <button onClick={() => decidirPercepcao(i, m.percepcao!, false)} className="press text-muted hover:text-ink">Dispensar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {enviando && (
          <div className="anim-fade-up flex items-end gap-2" role="status" aria-label="Claude está digitando">
            <Image src="/logo.png" alt="" width={28} height={28} className="shrink-0 rounded-full" />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3.5 shadow-sm" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-accent" style={{ animation: "pulo 1s infinite ease-in-out", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        {erro && <p className="rounded-xl bg-accent-soft p-3 text-sm">{erro}</p>}
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="sticky bottom-20 mt-6 flex gap-2 md:bottom-4"
      >
        <textarea
          value={texto}
          rows={1}
          aria-label="Pergunta sobre suas notas"
          onChange={(e) => { setTexto(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          placeholder={modo === "conversa" ? "Conte o que está no seu coração… (Shift+Enter quebra a linha)" : "Pergunte algo sobre suas notas… (Shift+Enter quebra a linha)"}
          className="flex-1 resize-none rounded-xl border border-line bg-card px-4 py-3 shadow-sm outline-none focus:border-accent"
        />
        <button
          disabled={enviando || !texto.trim()}
          className="press btn-accent self-end rounded-xl px-5 py-3 font-medium text-paper disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
