"use client";

import { useEffect, useRef, useState } from "react";
import { conversar, processarNota, prosear, transcrever } from "@/lib/cerebro";
import { supabase } from "@/lib/supabase";
import type { Mensagem, Percepcao } from "@/lib/types";
import { ListaFontes, TextoComCitacoes } from "@/components/Citacoes";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useDitado } from "@/components/useDitado";
import { useGravador } from "@/components/useGravador";

const SUGESTOES = [
  "What repeats the most in my notes?",
  "What themes has God been dealing with me about lately?",
  "How does what I wrote about faith connect to what I wrote about obedience?",
  "Where do I see tension or contradiction in my notes?",
];

const CHAVE = "sc_chat_v1";
const CHAVE_PROSA = "sc_prosa_v1";
const CHAVE_MODO = "sc_chat_modo_v1";
const ABERTURAS = ["I'm here. What's been on your heart today?", "What have you been thinking about lately?", "Was there something in your reading that stayed with you?"];

export default function Conversar() {
  const [modo, setModo] = useState<"conversa" | "notas">("conversa");
  const [carregado, setCarregado] = useState(false);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const [idioma, setIdioma] = useState<"en-US" | "pt-BR">("en-US");
  const [transcrevendo, setTranscrevendo] = useState(false);
  const ditado = useDitado((t) => setTexto((x) => (x ? `${x} ${t}` : t)), idioma);
  const gravador = useGravador(async (wav) => {
    setTranscrevendo(true);
    setErro(null);
    try {
      const { texto: falado } = await transcrever(wav, "audio/wav");
      await enviar(falado, true);
    } catch (e) {
      setErro((e as Error).message);
    }
    setTranscrevendo(false);
  });

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
        .insert({ conteudo: `Insight from a conversation: ${p.texto}`, referencias: p.passagem ? [p.passagem] : [], tags: ["insight"] })
        .select("id")
        .single();
      if (error || !data) { setErro(error?.message ?? "Couldn't save."); return; }
      void processarNota(data.id).catch(() => undefined);
    }
    setMsgs((m) => m.map((x, j) => (j === i && x.percepcao ? { ...x, percepcao: { ...x.percepcao, estado: guardar ? "guardada" : "dispensada" } } : x)));
  }

  async function enviar(pergunta: string, voz = false) {
    const q = pergunta.trim();
    if (!q || enviando) return;
    if (ditado.ativo) ditado.alternar();
    setErro(null);
    setTexto("");
    const historico = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q, voz }]);
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
        <h1 className="font-serif text-3xl">Chat</h1>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} className="text-sm text-muted hover:text-ink">
            New conversation
          </button>
        )}
      </div>
      <div role="tablist" className="mt-3 inline-flex rounded-2xl border border-line bg-card p-1 text-sm">
        {([["conversa", "Talk"], ["notas", "Ask my notes"]] as const).map(([k, nome]) => (
          <button key={k} role="tab" aria-selected={modo === k} onClick={() => trocarModo(k)}
            className={`press rounded-xl px-3 py-1.5 transition ${modo === k ? "btn-accent font-medium" : "text-muted"}`}>{nome}</button>
        ))}
      </div>
      <p className="mt-2 text-muted">{modo === "conversa" ? "Talk like you would with a friend. If I notice something, I'll tell you." : "Think alongside your notes."}</p>

      <div className="mt-6 flex-1 space-y-5">
        {msgs.length === 0 && modo === "conversa" && (
          <div className="grid gap-2">
            {ABERTURAS.map((s) => (
              <button key={s} onClick={() => enviar(s)} className="press lift rounded-2xl border border-line bg-card px-4 py-3 text-left text-sm hover:border-accent/60">{s}</button>
            ))}
            <p className="mt-2 text-xs text-muted">I listen, remember what you&apos;ve already written and, now and then, offer an insight. It&apos;s a hypothesis to take to prayer; you are the one who discerns.</p>
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
              I answer based on what you wrote, and raise connections and questions. The interpretation is still yours.
            </p>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="anim-fade-up ml-auto flex max-w-[88%] items-end gap-2">
              <div className="rounded-2xl rounded-br-md bg-accent px-4 py-3 text-paper shadow-sm">
                <p className="whitespace-pre-wrap">{m.voz && <span aria-label="Voice message" className="mr-1">🎤</span>}{m.content}</p>
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
                    <p className="text-xs font-medium uppercase tracking-wide text-accent">✦ I noticed something</p>
                    <p className="mt-1 font-serif leading-relaxed">{m.percepcao.texto}</p>
                    {m.percepcao.passagem && <p className="mt-1 text-xs text-muted">{m.percepcao.passagem}</p>}
                    {m.percepcao.estado === "guardada" ? (
                      <p className="mt-2 text-xs text-accent">✓ Saved to your notes</p>
                    ) : (
                      <div className="mt-2 flex gap-3">
                        <button onClick={() => decidirPercepcao(i, m.percepcao!, true)} className="press font-medium text-accent">Save as note</button>
                        <button onClick={() => decidirPercepcao(i, m.percepcao!, false)} className="press text-muted hover:text-ink">Dismiss</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {enviando && (
          <div className="anim-fade-up flex items-end gap-2" role="status" aria-label="Claude is typing">
            <Image src="/logo.png" alt="" width={28} height={28} className="shrink-0 rounded-full" />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3.5 shadow-sm" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-accent" style={{ animation: "pulo 1s infinite ease-in-out", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        {(erro ?? gravador.erro ?? ditado.erro) && <p className="rounded-xl bg-accent-soft p-3 text-sm">{erro ?? gravador.erro ?? ditado.erro}</p>}
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="sticky bottom-20 mt-6 flex gap-2 md:bottom-4"
      >
        {gravador.gravando ? (
          <div className="flex flex-1 items-center justify-between rounded-xl border border-accent bg-card px-4 py-3 shadow-sm">
            <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />Recording… {Math.floor(gravador.segundos / 60)}:{String(gravador.segundos % 60).padStart(2, "0")}</span>
            <button type="button" onClick={gravador.cancelar} className="press text-sm text-muted hover:text-ink">Cancel</button>
          </div>
        ) : (
          <textarea
            value={texto}
            rows={1}
            aria-label="Message"
            onChange={(e) => { setTexto(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            placeholder={transcrevendo ? "Transcribing your voice message…" : ditado.ativo ? "Listening… speak now" : modo === "conversa" ? "Tell me what's on your heart… (Shift+Enter for a new line)" : "Ask something about your notes… (Shift+Enter for a new line)"}
            className="flex-1 resize-none rounded-xl border border-line bg-card px-4 py-3 shadow-sm outline-none focus:border-accent"
          />
        )}
        {!gravador.gravando && ditado.suportado && (
          <>
            <button type="button" onClick={() => setIdioma((x) => (x === "en-US" ? "pt-BR" : "en-US"))} disabled={ditado.ativo} aria-label="Dictation language" title="Dictation language"
              className="press self-end rounded-xl border border-line bg-card px-2 py-3 text-xs font-medium text-muted disabled:opacity-50">{idioma === "en-US" ? "EN" : "PT"}</button>
            <button type="button" onClick={ditado.alternar} aria-label={ditado.ativo ? "Stop dictation" : "Dictate (speech to text)"} title="Dictate: speech becomes text you can edit"
              className={`press self-end rounded-xl border px-3 py-3 ${ditado.ativo ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-muted"}`}><Icon nome="microfone" /></button>
          </>
        )}
        {gravador.suportado && (
          <button type="button" onClick={gravador.gravando ? gravador.parar : gravador.iniciar} disabled={enviando || transcrevendo}
            aria-label={gravador.gravando ? "Stop and send voice message" : "Record a voice message"} title={gravador.gravando ? "Stop and send" : "Record a voice message"}
            className={`press self-end rounded-xl px-3 py-3 disabled:opacity-50 ${gravador.gravando ? "btn-accent text-paper" : "border border-line bg-card text-muted"}`}>
            {gravador.gravando ? <span className="block h-5 w-5 rounded-sm bg-current" /> : <span className="block text-lg leading-5">🎙️</span>}
          </button>
        )}
        {!gravador.gravando && (
          <button
            disabled={enviando || transcrevendo || !texto.trim()}
            className="press btn-accent self-end rounded-xl px-5 py-3 font-medium text-paper disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
