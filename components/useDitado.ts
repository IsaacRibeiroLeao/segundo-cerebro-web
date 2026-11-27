"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

// Ditado por voz com a Web Speech API (Chrome, Edge e Safari).
export function useDitado(aoFinalizarTrecho: (texto: string) => void, idioma = "en-US") {
  const [ativo, setAtivo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<Reconhecimento | null>(null);
  const cb = useRef(aoFinalizarTrecho);
  useEffect(() => {
    cb.current = aoFinalizarTrecho;
  });

  const [suportado] = useState(
    () => typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
  );

  const alternar = useCallback(() => {
    if (ativo) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = idioma;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim());
      }
    };
    r.onerror = (e) => setErro(e.error === "not-allowed" ? "Allow microphone use in your browser." : "Couldn't listen right now.");
    r.onend = () => setAtivo(false);
    setErro(null);
    rec.current = r;
    r.start();
    setAtivo(true);
  }, [ativo, idioma]);

  useEffect(() => () => rec.current?.stop(), []);
  return { ativo, suportado, erro, alternar };
}
