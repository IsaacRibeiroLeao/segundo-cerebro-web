"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SEGUNDOS = 90;
const TAXA = 16000;

function paraWav(canal: Float32Array, taxa: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + canal.length * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, "RIFF"); v.setUint32(4, 36 + canal.length * 2, true); txt(8, "WAVE"); txt(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, "data"); v.setUint32(40, canal.length * 2, true);
  for (let i = 0; i < canal.length; i++) {
    const s = Math.max(-1, Math.min(1, canal[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function base64De(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function converter(blob: Blob): Promise<string> {
  const ctx = new AudioContext();
  try {
    const dec = await ctx.decodeAudioData(await blob.arrayBuffer());
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(dec.duration * TAXA)), TAXA);
    const src = off.createBufferSource();
    src.buffer = dec;
    src.connect(off.destination);
    src.start();
    const pronto = await off.startRendering();
    return base64De(paraWav(pronto.getChannelData(0), TAXA));
  } finally {
    void ctx.close();
  }
}

// Grava do microfone e entrega o áudio em WAV (base64) para transcrição no servidor.
export function useGravador(aoTerminar: (wavBase64: string) => void | Promise<void>) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelado = useRef(false);
  const cb = useRef(aoTerminar);
  useEffect(() => { cb.current = aoTerminar; });

  const [suportado] = useState(
    () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined",
  );

  const limpar = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    setGravando(false);
  }, []);

  const parar = useCallback(() => { if (rec.current?.state === "recording") rec.current.stop(); }, []);
  const cancelar = useCallback(() => { cancelado.current = true; parar(); }, [parar]);

  const iniciar = useCallback(async () => {
    setErro(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      fluxo.current = s;
      const partes: Blob[] = [];
      const r = new MediaRecorder(s);
      cancelado.current = false;
      r.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      r.onstop = async () => {
        const foiCancelado = cancelado.current;
        limpar();
        if (foiCancelado || !partes.length) return;
        try {
          await cb.current(await converter(new Blob(partes, { type: r.mimeType })));
        } catch {
          setErro("Couldn't process the recording.");
        }
      };
      rec.current = r;
      r.start();
      setSegundos(0);
      setGravando(true);
      timer.current = setInterval(() => {
        setSegundos((x) => {
          if (x + 1 >= MAX_SEGUNDOS) parar();
          return x + 1;
        });
      }, 1000);
    } catch {
      limpar();
      setErro("Allow microphone use in your browser.");
    }
  }, [limpar, parar]);

  useEffect(() => () => { cancelado.current = true; if (rec.current?.state === "recording") rec.current.stop(); limpar(); }, [limpar]);
  return { gravando, segundos, erro, suportado, iniciar, parar, cancelar };
}
