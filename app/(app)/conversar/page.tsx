"use client";

import { useEffect, useRef, useState } from "react";
import { conversar } from "@/lib/cerebro";
import type { Mensagem } from "@/lib/types";
import { ListaFontes, TextoComCitacoes } from "@/components/Citacoes";
import { Pensando } from "@/components/Pensando";

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
            <div key={i} className="anim-fade-up ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-paper">
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="anim-fade-up max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3">
              <TextoComCitacoes texto={m.content} fontes={m.fontes ?? []} />
              <ListaFontes fontes={(m.fontes ?? []).filter((f) => m.content.includes(`[${f.n}]`))} />
            </div>
          ),
        )}

        {enviando && <p className="anim-fade-in text-sm"><Pensando texto="Pensando junto com você" /></p>}
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
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pergunte algo sobre suas notas…"
          className="flex-1 rounded-xl border border-line bg-card px-4 py-3 shadow-sm outline-none focus:border-accent"
        />
        <button
          disabled={enviando || !texto.trim()}
          className="press rounded-xl bg-accent px-5 font-medium text-paper disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
