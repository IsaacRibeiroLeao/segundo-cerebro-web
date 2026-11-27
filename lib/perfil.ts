"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type Perfil = { nome: string | null; avatar: string | null };

// Estado único compartilhado: trocar a foto atualiza todos os avatares da tela ao mesmo tempo.
let estado: Perfil | null = null;
let carregando = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

async function carregar() {
  if (carregando) return;
  carregando = true;
  const { data } = await supabase.from("sc_perfil").select("nome, avatar").maybeSingle();
  estado = { nome: data?.nome ?? null, avatar: data?.avatar ?? null };
  carregando = false;
  avisar();
}

export function limparPerfil() {
  estado = null;
  avisar();
}

export function usePerfil() {
  const perfil = useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => ouvintes.delete(f); },
    () => estado,
    () => null,
  );
  useEffect(() => {
    if (!estado) carregar();
  }, []);

  const salvar = useCallback(async (novo: Partial<Perfil>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Session expired. Please sign in again.");
    const prox = { nome: estado?.nome ?? null, avatar: estado?.avatar ?? null, ...novo };
    const { error } = await supabase.from("sc_perfil").upsert({ user_id: u.user.id, ...prox, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
    estado = prox;
    avisar();
  }, []);

  return { perfil, salvar };
}

// Recorta o centro em quadrado, reduz para 256px e devolve JPEG em data URL (cabe folgado na coluna).
export function reduzirImagem(arquivo: File, lado = 256): Promise<string> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const m = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = lado;
      c.getContext("2d")!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("I couldn't read that image.")); };
    img.src = url;
  });
}
