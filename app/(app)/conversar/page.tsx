"use client";

import { useEffect, useRef, useState } from "react";
import { conversar } from "@/lib/cerebro";
import type { Mensagem } from "@/lib/types";
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

export default function Conversar() {
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo) setMsgs(JSON.parse(salvo));
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(msgs.slice(-40)));
    } catch {
      /* ignora */
    }
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || enviando) return;
    setErro(null);
    setTexto("");
    const historico = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setEnviando(true);
    try {
      const r = await conversar(q, historico);
      setMsgs((m) => [...m, { role: "assistant", content: r.resposta, fontes: r.fontes }]);
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
      <p className="mt-1 text-muted">Pense junto com as suas anotações.</p>

      <div className="mt-6 flex-1 space-y-5">
        {msgs.length === 0 && (
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
          placeholder="Pergunte algo sobre suas notas… (Shift+Enter quebra a linha)"
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
